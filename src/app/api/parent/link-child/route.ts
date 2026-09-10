import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { childEmail } = await req.json();
  if (!childEmail?.trim()) {
    return NextResponse.json({ error: "Please enter your child's email." }, { status: 400 });
  }

  const parent = await prisma.parent.findUnique({ where: { userId }, include: { user: true } });
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

  // Parent-Student Linking Trust Boundary kilometer — knowing the
  // child's email is no longer sufficient for protected access by
  // itself. An existing row (confirmed OR still-pending) is left
  // completely untouched here — never re-created, never reset — so a
  // repeat call can never downgrade an already-confirmed relationship
  // back to pending.
  const existingLink = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: { parentId: parent.id, studentId: childUser.studentProfile.id },
    },
  });
  if (existingLink) {
    if (existingLink.confirmedAt) {
      return NextResponse.json({ ok: true, alreadyLinked: true });
    }
    return NextResponse.json({ ok: true, pending: true, alreadyRequested: true });
  }

  await prisma.parentStudent.create({
    data: { parentId: parent.id, studentId: childUser.studentProfile.id, confirmedAt: null },
  });

  await notify(
    childUser.id,
    "PARENT_LINK_REQUESTED",
    `${parent.user.name} wants to link as your parent`,
    "Review this request from your dashboard. Nothing is shared until you confirm it."
  );

  return NextResponse.json({ ok: true, pending: true });
}
