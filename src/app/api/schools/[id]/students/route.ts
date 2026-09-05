import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { createStudentAffiliation } from "@/lib/affiliation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  // Any approved teacher at this school, or the school's admin, can view
  // its student roster — matches the interim rule that grade-scoping
  // isn't built yet (Phase 2).
  //
  // Phase 4C: teacher membership resolved via an ACTIVE
  // TeacherSchoolAffiliation (matching the prior approved:true filter
  // exactly), not the Teacher.schoolId bridge field — so a teacher
  // active at this school is recognized even if their bridge points
  // elsewhere due to another concurrent affiliation.
  const [teacherRecord, admin] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId } }),
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: params.id } } }),
  ]);
  const teacherAffiliation = teacherRecord
    ? await prisma.teacherSchoolAffiliation.findFirst({
        where: { teacherId: teacherRecord.id, schoolId: params.id, status: "ACTIVE" },
      })
    : null;
  if (!teacherAffiliation && !admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const students = await prisma.student.findMany({
    where: { schoolId: params.id, approved: true },
    include: { user: true, skills: { include: { addedBy: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ students });
}

const createStudentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  academicSessionId: z.string().optional(),
  schoolGradeId: z.string().optional(),
  sectionId: z.string().optional(),
});

/**
 * Directly creates a Student MEGA ID on the School Admin's behalf — for
 * students who can't self-register (not every student in Nepal has
 * their own device/email to complete the self-registration flow).
 * Approved immediately, unlike self-registration's pending-approval
 * queue: there's nothing to vet here, the admin themselves is creating
 * the account. Reuses the exact User/Student creation shape from
 * register-student, and — if a grade is given — the exact direct-
 * creation GradeHistory shape from grade-placements (status
 * "ENROLLED", not routed through recordGradeDecision(); a first
 * placement isn't a decision — see PRODUCT_RULES.md). No parallel
 * enrollment system.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createStudentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid name, email, and password (at least 8 characters)." },
      { status: 400 }
    );
  }
  const { name, email, password, academicSessionId, schoolGradeId, sectionId } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  // Validate the placement target BEFORE creating anything — a bad
  // grade/section shouldn't leave a half-created student account
  // behind.
  let validGradeId: string | null = null;
  let validSectionId: string | null = null;
  if (schoolGradeId) {
    if (!academicSessionId) {
      return NextResponse.json({ error: "Select an academic session for this placement." }, { status: 400 });
    }
    const [session, grade] = await Promise.all([
      prisma.academicSession.findUnique({ where: { id: academicSessionId } }),
      prisma.schoolGrade.findUnique({ where: { id: schoolGradeId } }),
    ]);
    if (!session || session.schoolId !== params.id) {
      return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
    }
    if (!grade || grade.schoolId !== params.id) {
      return NextResponse.json({ error: "Invalid grade." }, { status: 400 });
    }
    validGradeId = schoolGradeId;
    if (sectionId) {
      const section = await prisma.section.findUnique({ where: { id: sectionId } });
      if (!section || section.schoolGradeId !== schoolGradeId || !section.isActive) {
        return NextResponse.json({ error: "Invalid section for this grade." }, { status: 400 });
      }
      validSectionId = sectionId;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const student = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email: normalizedEmail, passwordHash, roles: { create: [{ role: "STUDENT" }] } },
    });
    const student = await tx.student.create({
      data: { userId: user.id, fullName: name, schoolId: params.id, approved: true },
    });

    // A School Admin adding a student directly vets them by construction
    // — approved immediately, same ACTIVE semantics as an admin approving
    // a self-service join.
    await createStudentAffiliation(tx, { studentId: student.id, schoolId: params.id, status: "ACTIVE" });

    if (validGradeId && academicSessionId) {
      await tx.gradeHistory.create({
        data: {
          studentId: student.id,
          schoolGradeId: validGradeId,
          sectionId: validSectionId,
          academicSessionId,
          status: "ENROLLED",
        },
      });
    }
    return student;
  });

  return NextResponse.json({ ok: true, studentId: student.id });
}
