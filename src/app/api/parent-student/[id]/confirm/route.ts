import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Parent-Student Linking Trust Boundary kilometer — the Student's own
 * confirmation of a pending ParentStudent request. Student-only: the
 * authenticated user must be the exact Student party to this specific
 * row, resolved fresh every call, never inferred. Idempotent-safe if
 * already confirmed (no-op success, timestamp untouched) — this route
 * only ever moves confirmedAt from null to now(), never backwards.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const link = await prisma.parentStudent.findUnique({
    where: { id: params.id },
    include: { student: { select: { userId: true } } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (link.student.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (link.confirmedAt) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  const updated = await prisma.parentStudent.update({
    where: { id: params.id },
    data: { confirmedAt: new Date() },
  });

  return NextResponse.json({ ok: true, confirmedAt: updated.confirmedAt });
}
