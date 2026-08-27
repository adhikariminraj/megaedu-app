import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

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

  await prisma.student.update({ where: { id: params.studentId }, data: { approved: true } });
  return NextResponse.json({ ok: true });
}
