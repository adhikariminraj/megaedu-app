import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCKED_MESSAGE =
  "You've already changed your interests this academic session. You'll be able to change them again once the next session starts.";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const interest = await prisma.interest.findUnique({ where: { id: params.id } });
  if (!interest || interest.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true, schoolId: true, interestsLockedForSessionId: true },
  });
  let activeSessionId: string | null = null;
  if (student?.schoolId) {
    const activeSession = await prisma.academicSession.findFirst({
      where: { schoolId: student.schoolId, status: "ACTIVE" },
      select: { id: true },
    });
    activeSessionId = activeSession?.id ?? null;
    if (activeSessionId && student.interestsLockedForSessionId === activeSessionId) {
      return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 403 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.interest.delete({ where: { id: params.id } });
    if (student && activeSessionId) {
      await tx.student.update({
        where: { id: student.id },
        data: { interestsLockedForSessionId: activeSessionId },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
