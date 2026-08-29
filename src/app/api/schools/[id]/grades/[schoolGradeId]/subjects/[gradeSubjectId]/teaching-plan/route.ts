import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

/**
 * Sets or updates the planned-total/display-label teaching plan for one
 * (gradeSubject, sectionId) scope. Find-or-update-else-create, not a
 * bare insert — at most one plan should exist per (gradeSubjectId,
 * sectionId), and a plain @@unique can't reliably catch two
 * sectionId: null rows colliding (same NULL-in-unique-index caveat as
 * elsewhere in this schema). sectionId null means the grade-wide plan.
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

  const body = (await req.json()) as {
    sectionId?: string | null;
    plannedTotal?: number;
    unitLabel?: string;
  };
  const { sectionId, unitLabel } = body;
  if (!Number.isInteger(body.plannedTotal) || (body.plannedTotal as number) < 1) {
    return NextResponse.json({ error: "Enter a planned total of at least 1." }, { status: 400 });
  }
  const plannedTotal: number = body.plannedTotal as number;

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

  const existing = await prisma.teachingPlan.findFirst({
    where: { gradeSubjectId: params.gradeSubjectId, sectionId: targetSectionId },
  });

  const plan = existing
    ? await prisma.teachingPlan.update({
        where: { id: existing.id },
        data: { plannedTotal, unitLabel: unitLabel?.trim() || existing.unitLabel },
      })
    : await prisma.teachingPlan.create({
        data: {
          gradeSubjectId: params.gradeSubjectId,
          academicSessionId: gradeSubject.academicSessionId,
          schoolGradeId: params.schoolGradeId,
          sectionId: targetSectionId,
          subjectId: gradeSubject.subjectId,
          plannedTotal,
          unitLabel: unitLabel?.trim() || "Unit",
          createdByUserId: userId,
        },
      });

  return NextResponse.json({ ok: true, plan });
}
