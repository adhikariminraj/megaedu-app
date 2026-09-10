import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Parent-Student Linking Trust Boundary kilometer — the one DELETE
 * operation serving decline (pending row), cancel (pending row,
 * deleted by the Parent who requested it), and unlink (confirmed row,
 * either party) alike. Authorization is based solely on the
 * authenticated user being one of the two parties to THIS exact row —
 * never a School Admin, an Organization Admin, or any other user.
 * Always a hard delete — no ENDED/REJECTED state is retained, since
 * nothing in this codebase consumes that history.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const link = await prisma.parentStudent.findUnique({
    where: { id: params.id },
    include: {
      parent: { select: { userId: true } },
      student: { select: { userId: true } },
    },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParty = link.parent.userId === userId || link.student.userId === userId;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.parentStudent.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
