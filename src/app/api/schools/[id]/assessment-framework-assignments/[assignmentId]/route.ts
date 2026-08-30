import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Removes one AssessmentFrameworkAssignment. Not audited — current-
 * state operational config, same as TeacherAcademicAssignment/
 * ClassTeacherAssignment's own DELETE routes. Blocked once any
 * AssessmentComponentResult or AssessmentResultPublication references
 * it — a real result or publication decision must never be left
 * pointing at a deleted assignment, and re-resolving which structure
 * governed it would become impossible.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; assignmentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignment = await prisma.assessmentFrameworkAssignment.findUnique({
    where: { id: params.assignmentId },
  });
  if (!assignment || assignment.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [hasResults, hasPublications] = await Promise.all([
    prisma.assessmentComponentResult.findFirst({ where: { assignmentId: params.assignmentId } }),
    prisma.assessmentResultPublication.findFirst({ where: { assignmentId: params.assignmentId } }),
  ]);
  if (hasResults || hasPublications) {
    return NextResponse.json(
      { error: "This assignment has assessment results or publications recorded against it and cannot be deleted." },
      { status: 409 }
    );
  }

  await prisma.assessmentFrameworkAssignment.delete({ where: { id: params.assignmentId } });
  return NextResponse.json({ ok: true });
}
