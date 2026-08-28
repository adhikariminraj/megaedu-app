import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; assignmentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignment = await prisma.teacherGradeAssignment.findUnique({
    where: { id: params.assignmentId },
    include: { schoolGrade: true },
  });
  if (!assignment || assignment.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.teacherGradeAssignment.delete({ where: { id: params.assignmentId } });
  return NextResponse.json({ ok: true });
}
