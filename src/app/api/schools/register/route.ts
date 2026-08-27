import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  schoolName: z.string().min(2),
  location: z.string().optional(),
  gradesOffered: z.string().optional(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { adminName, adminEmail, adminPassword, schoolName, location, gradesOffered } =
    parsed.data;

  const email = adminEmail.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  let slug = slugify(schoolName);
  const slugTaken = await prisma.school.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Registration is intentionally short (per the plan's own guardrail) —
  // additional profile detail is added later from the dashboard, not here.
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: adminName,
        email,
        passwordHash,
        roles: { create: [{ role: "SCHOOL_ADMIN" }] },
      },
    });

    const school = await tx.school.create({
      data: {
        name: schoolName,
        slug,
        location,
        gradesOffered,
        verified: false, // schools start unverified — see Diagram 3 (Verification step)
      },
    });

    await tx.schoolAdmin.create({
      data: { userId: user.id, schoolId: school.id },
    });

    return { user, school };
  });

  return NextResponse.json({ ok: true, schoolSlug: result.school.slug });
}
