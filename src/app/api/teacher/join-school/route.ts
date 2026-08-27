import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { schoolId, position, subjects } = await req.json();
  if (!schoolId) return NextResponse.json({ error: "Please choose a school." }, { status: 400 });

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || !school.verified) {
    return NextResponse.json({ error: "Please choose a verified school." }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return NextResponse.json({ error: "Teacher profile not found." }, { status: 404 });

  const updated = await prisma.teacher.update({
    where: { userId },
    data: {
      schoolId,
      position: POSITIONS.includes(position) ? position : "Teacher",
      subjects: subjects || null,
      approved: false, // joining (or re-joining) a school always needs fresh approval
    },
  });

  return NextResponse.json({ ok: true, teacher: updated });
}
