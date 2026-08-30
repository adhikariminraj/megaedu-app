import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Removes one AssessmentFrameworkAssignment. Not audited — current-
 * state operational config, same as TeacherAcademicAssignment/
 * ClassTeacherAssignment's own DELETE routes.
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

  await prisma.assessmentFrameworkAssignment.delete({ where: { id: params.assignmentId } });
  return NextResponse.json({ ok: true });
}
