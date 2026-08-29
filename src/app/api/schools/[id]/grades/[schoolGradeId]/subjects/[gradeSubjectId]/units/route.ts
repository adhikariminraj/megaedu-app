import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

/**
 * Creates one TeachingUnit (Unit/Chapter) under a subject offering.
 * sectionId null = grade-wide unit sequence (shared by every section);
 * a real value = that section's own, independent sequence. `order` is
 * app-assigned (current count within this exact gradeSubjectId+
 * sectionId scope, + 1) — not a DB unique constraint, for the same
 * NULL-in-unique-index reason documented on the schema.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; schoolGradeId: string; gradeSubjectId: string } }
) {
  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { schoolGrade: true },
  });
  if (
    !gradeSubject ||
    gradeSubject.schoolGrade.schoolId !== params.id ||
    gradeSubject.schoolGradeId !== params.schoolGradeId
  ) {
    return NextResponse.json({ error: "Subject offering not found." }, { status: 404 });
  }

  const { sectionId, title } = (await req.json()) as { sectionId?: string | null; title?: string };
  if (!title?.trim()) {
    return NextResponse.json({ error: "Enter a title for this unit/chapter." }, { status: 400 });
  }

  const targetSectionId = sectionId || null;
  if (targetSectionId) {
    const section = await prisma.section.findUnique({ where: { id: targetSectionId } });
    if (!section || section.schoolGradeId !== params.schoolGradeId || !section.isActive) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: gradeSubject.academicSessionId,
      schoolGradeId: params.schoolGradeId,
      sectionId: targetSectionId,
      subjectId: gradeSubject.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existingCount = await prisma.teachingUnit.count({
    where: { gradeSubjectId: params.gradeSubjectId, sectionId: targetSectionId },
  });

  const unit = await prisma.teachingUnit.create({
    data: {
      gradeSubjectId: params.gradeSubjectId,
      academicSessionId: gradeSubject.academicSessionId,
      schoolGradeId: params.schoolGradeId,
      sectionId: targetSectionId,
      subjectId: gradeSubject.subjectId,
      title: title.trim(),
      order: existingCount + 1,
      createdByUserId: userId,
    },
  });

  return NextResponse.json({ ok: true, unit });
}
