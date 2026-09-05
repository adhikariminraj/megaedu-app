import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTeacherAffiliation } from "@/lib/affiliation";

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"] as const;

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  schoolId: z.string().min(1),
  position: z.enum(POSITIONS).default("Teacher"),
  subjects: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, schoolId, subjects, position } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || !school.verified) {
    return NextResponse.json({ error: "Please choose a verified school." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        roles: { create: [{ role: "TEACHER" }] },
      },
    });

    const teacher = await tx.teacher.create({
      data: { userId: user.id, fullName: name, schoolId, subjects, position, approved: false },
    });

    // Self-registration always needs fresh approval — same PENDING
    // semantics as the self-service /api/teacher/join-school route.
    await createTeacherAffiliation(tx, {
      teacherId: teacher.id,
      schoolId,
      status: "PENDING",
      position,
      subjects: subjects ?? null,
    });
  });

  return NextResponse.json({ ok: true });
}
