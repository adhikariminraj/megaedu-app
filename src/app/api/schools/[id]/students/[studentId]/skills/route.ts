import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const [teacher, admin] = await Promise.all([
    prisma.teacher.findFirst({ where: { userId, schoolId: params.id, approved: true } }),
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: params.id } } }),
  ]);
  if (!teacher && !admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student || student.schoolId !== params.id) {
    return NextResponse.json({ error: "Student not found at this school." }, { status: 404 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Skill name is required." }, { status: 400 });

  try {
    const skill = await prisma.skill.create({
      data: { studentId: params.studentId, addedByUserId: userId, name: name.trim() },
    });
    return NextResponse.json({ ok: true, skill });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Same teacher already added this exact skill to this student — not an
      // error from the teacher's point of view, the skill is already there.
      return NextResponse.json({ ok: true, alreadyExists: true });
    }
    throw err;
  }
}
