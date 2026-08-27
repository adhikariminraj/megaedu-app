import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; teacherId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher || teacher.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.teacher.update({ where: { id: params.teacherId }, data: { approved: true } });
  return NextResponse.json({ ok: true });
}
