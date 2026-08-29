import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Removes one subject from a grade's offering for the session it
 * belongs to. A real delete (unlike Subject/Section) — nothing
 * permanent references a GradeSubject row directly, since it's
 * session-scoped, freely-editable current-state config, not a
 * historical record. Blocked with a clear error (not a raw FK crash)
 * if a TeacherAcademicAssignment already depends on it — remove the
 * teacher assignment(s) first.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; schoolGradeId: string; gradeSubjectId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const assignmentCount = await prisma.teacherAcademicAssignment.count({
    where: { gradeSubjectId: params.gradeSubjectId },
  });
  if (assignmentCount > 0) {
    return NextResponse.json(
      {
        error:
          "This subject has teacher assignments this session. Remove those assignments first.",
      },
      { status: 409 }
    );
  }

  await prisma.gradeSubject.delete({ where: { id: params.gradeSubjectId } });
  return NextResponse.json({ ok: true });
}
