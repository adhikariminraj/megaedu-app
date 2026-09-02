import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ROLES = ["STUDENT", "TEACHER", "PARENT", "SCHOOL_ADMIN", "ORGANIZATION_ADMIN"] as const;

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(ROLES),
});

/**
 * Creates a MEGA ID with exactly one role, but deliberately does NOT ask
 * for (or create) a school/organization affiliation here. That happens
 * afterward, from the person's own dashboard, once they're ready —
 * see /api/teacher/join-school, /api/student/join-school,
 * /api/parent/link-child, /api/schools/create-for-admin, and
 * /api/organizations/create-for-admin.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        roles: { create: [{ role }] },
      },
    });

    // Teacher, Student, and Parent get their profile row created right
    // away (unaffiliated) so their dashboard has something to build on.
    // School Admin and Organization Admin don't get a profile here —
    // there's nothing to attach it to until they actually create their
    // School or Organization from the dashboard.
    if (role === "TEACHER") {
      await tx.teacher.create({ data: { userId: user.id, fullName: name, approved: false } });
    } else if (role === "STUDENT") {
      await tx.student.create({ data: { userId: user.id, fullName: name, approved: false } });
    } else if (role === "PARENT") {
      await tx.parent.create({ data: { userId: user.id } });
    }
  });

  return NextResponse.json({ ok: true });
}
