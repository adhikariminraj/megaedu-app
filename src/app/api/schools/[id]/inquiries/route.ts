import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Message is required.").max(4000),
  // Honeypot: a real visitor never fills this in (it's hidden via CSS in
  // the form). Any non-empty value here is treated as a bot and silently
  // discarded — see below.
  website: z.string().optional().or(z.literal("")),
});

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Public, unauthenticated: a visitor contacting a school. This is
 * deliberately the first unauthenticated write route in the app — no
 * session, no MEGA ID, no affiliation is created or required. Only
 * verified + active schools accept inquiries, matching the same
 * publicly-reachable gate already enforced on the school directory and
 * profile pages.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const school = await prisma.school.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, verified: true, isActive: true },
  });
  if (!school || !school.verified || !school.isActive) {
    return NextResponse.json({ error: "This school is not accepting inquiries." }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, phone, message, website } = parsed.data;

  // Silent discard: pretend success so a bot gets no signal that its
  // submission was rejected specifically for the honeypot.
  if (website && website.trim() !== "") {
    return NextResponse.json({ ok: true, schoolName: school.name });
  }

  const ipAddress = clientIp(req);
  if (ipAddress !== "unknown") {
    const recentCount = await prisma.inquiry.count({
      where: { ipAddress, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many inquiries submitted recently. Please try again later." },
        { status: 429 }
      );
    }
  }

  await prisma.inquiry.create({
    data: {
      schoolId: school.id,
      category: "GENERAL",
      name,
      email,
      phone: phone || null,
      message,
      ipAddress: ipAddress !== "unknown" ? ipAddress : null,
    },
  });

  return NextResponse.json({ ok: true, schoolName: school.name });
}

/**
 * School-Admin-only: list this school's inquiries, newest first. Not
 * currently called by the admin inbox page (which queries Prisma
 * directly server-side, matching the existing convention used by every
 * other dashboard list page in this app — see e.g. dashboard/grades) —
 * kept as a real route regardless, since a list endpoint independent of
 * the page's own render is a reasonable, low-cost thing to have.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const inquiries = await prisma.inquiry.findMany({
    where: { schoolId: params.id },
    orderBy: { createdAt: "desc" },
    // ipAddress is server-side only (rate-limiting) — never returned to
    // any client, per the field's own documented contract in schema.prisma.
    select: {
      id: true,
      schoolId: true,
      category: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ inquiries });
}
