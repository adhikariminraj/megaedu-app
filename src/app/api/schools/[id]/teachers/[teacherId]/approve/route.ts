import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";

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

  const school = await prisma.school.findUnique({ where: { id: params.id }, select: { name: true } });

  await prisma.teacher.update({ where: { id: params.teacherId }, data: { approved: true } });
  await notify(
    teacher.userId,
    "STAFF_APPROVED",
    `You're approved at ${school?.name || "your school"}!`,
    "Your account is now active — you have full access to your school dashboard."
  );

  return NextResponse.json({ ok: true });
}
