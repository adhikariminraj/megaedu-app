import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; studentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student || student.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const school = await prisma.school.findUnique({ where: { id: params.id }, select: { name: true } });

  await prisma.student.update({ where: { id: params.studentId }, data: { approved: true } });
  // Nothing to notify if this student has no linked MEGA account yet.
  if (student.userId) {
    await notify(
      student.userId,
      "STUDENT_APPROVED",
      `You're approved at ${school?.name || "your school"}!`,
      "Your account is now active — you have full access to your school dashboard."
    );
  }

  return NextResponse.json({ ok: true });
}
