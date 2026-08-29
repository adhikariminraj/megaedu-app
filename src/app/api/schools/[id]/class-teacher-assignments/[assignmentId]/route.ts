import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Removes one ClassTeacherAssignment. Not audited — current-state
 * operational data, same as TeacherGradeAssignment/TeacherAcademicAssignment's
 * own DELETE routes.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; assignmentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignment = await prisma.classTeacherAssignment.findUnique({
    where: { id: params.assignmentId },
    include: { schoolGrade: true },
  });
  if (!assignment || assignment.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.classTeacherAssignment.delete({ where: { id: params.assignmentId } });
  return NextResponse.json({ ok: true });
}
