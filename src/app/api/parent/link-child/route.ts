import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { childEmail } = await req.json();
  if (!childEmail?.trim()) {
    return NextResponse.json({ error: "Please enter your child's email." }, { status: 400 });
  }

  const parent = await prisma.parent.findUnique({ where: { userId } });
  if (!parent) return NextResponse.json({ error: "Parent profile not found." }, { status: 404 });

  const childUser = await prisma.user.findUnique({
    where: { email: childEmail.toLowerCase() },
    include: { studentProfile: true },
  });
  if (!childUser?.studentProfile) {
    return NextResponse.json(
      {
        error:
          "We couldn't find a student account with that email. Your child needs to register as a student first.",
      },
      { status: 400 }
    );
  }

  const existingLink = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: { parentId: parent.id, studentId: childUser.studentProfile.id },
    },
  });
  if (existingLink) {
    return NextResponse.json({ ok: true, alreadyLinked: true });
  }

  await prisma.parentStudent.create({
    data: { parentId: parent.id, studentId: childUser.studentProfile.id },
  });

  return NextResponse.json({ ok: true });
}
