import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

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

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student) return NextResponse.json({ error: "Student not found at this school." }, { status: 404 });
  // Phase 4C: institutional membership resolved via StudentSchoolAffiliation
  // (ACTIVE or PENDING — matches the prior bridge-based check, which had no
  // approved filter of its own), not the Student.schoolId bridge field.
  const studentAffiliation = await prisma.studentSchoolAffiliation.findFirst({
    where: { studentId: student.id, schoolId: params.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (!studentAffiliation) {
    return NextResponse.json({ error: "Student not found at this school." }, { status: 404 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Skill name is required." }, { status: 400 });

  try {
    const skill = await prisma.skill.create({
      data: { studentId: params.studentId, addedByUserId: userId, name: name.trim() },
    });
    return NextResponse.json({ ok: true, skill });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Same teacher already added this exact skill to this student — not an
      // error from the teacher's point of view, the skill is already there.
      return NextResponse.json({ ok: true, alreadyExists: true });
    }
    throw err;
  }
}
