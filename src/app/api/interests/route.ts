import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCKED_MESSAGE =
  "You've already changed your interests this academic session. You'll be able to change them again once the next session starts.";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const body = await req.json();
  const rawNames: unknown[] = Array.isArray(body?.names) ? body.names : body?.name ? [body.name] : [];
  const names = Array.from(
    new Set(
      rawNames
        .map((n) => (typeof n === "string" ? n.trim() : ""))
        .filter((n) => n.length > 0)
    )
  );
  if (names.length === 0) {
    return NextResponse.json({ error: "At least one interest name is required." }, { status: 400 });
  }

  // Only a Student's interest list is session-locked — a Teacher (or
  // anyone else) using the same shared Interest model stays freely
  // editable, matching the original "Freely editable for now" wording.
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

  const created: { id: string; name: string }[] = [];
  const alreadyExisting: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const name of names) {
      const existing = await tx.interest.findUnique({ where: { userId_name: { userId, name } } });
      if (existing) {
        alreadyExisting.push(name);
        continue;
      }
      const interest = await tx.interest.create({ data: { userId, name } });
      created.push(interest);
    }
    // Only a genuine new addition counts as "a change" — resubmitting
    // names that already existed doesn't consume the session's one
    // allowed change.
    if (created.length > 0 && student && activeSessionId) {
      await tx.student.update({
        where: { id: student.id },
        data: { interestsLockedForSessionId: activeSessionId },
      });
    }
  });

  return NextResponse.json({ ok: true, created, alreadyExisting });
}
