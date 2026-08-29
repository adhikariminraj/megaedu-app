import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"] as const;

const createTeacherSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  position: z.enum(POSITIONS).default("Teacher"),
  subjects: z.string().optional(),
});

/**
 * Directly creates a Teacher/Staff MEGA ID on the School Admin's
 * behalf. Approved immediately, same reasoning as
 * students/route.ts's POST handler. Deliberately does NOT touch
 * academic assignments (TeacherGradeAssignment, TeacherAcademicAssignment,
 * ClassTeacherAssignment) — those remain a separate, later step
 * through the existing Academic Structure system (/dashboard/academics),
 * unchanged by this route.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createTeacherSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, email, and password (at least 8 characters)." },
      { status: 400 }
    );
  }
  const { name, email, password, position, subjects } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: normalizedEmail, passwordHash, roles: { create: [{ role: "TEACHER" }] } },
    });
    return tx.teacher.create({
      data: { userId: user.id, schoolId: params.id, position, subjects, approved: true },
    });
  });

  return NextResponse.json({ ok: true, teacherId: teacher.id });
}
