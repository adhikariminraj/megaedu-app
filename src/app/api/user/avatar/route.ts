import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage, deleteUploadedImage, UploadValidationError } from "@/lib/uploads";

// Self-service only — a user manages their own MEGA ID photo, never
// someone else's. No requireX() helper exists for "acting on your own
// User row" because nothing has needed one before this; every other
// self-service write in this codebase (e.g. /api/interests) checks the
// session's own userId inline the same way, so this follows that
// existing convention rather than inventing a new authorize.ts helper
// for a single trivial check.

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } });
  return NextResponse.json({ name: user?.name ?? null, avatarUrl: user?.avatarUrl ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  let newUrl: string;
  try {
    newUrl = await saveUploadedImage(file, `users/${userId}`);
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // Same save-then-update-then-cleanup order as the school logo route —
  // never delete the previous photo before the new one is saved and the
  // DB row is updated successfully.
  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: newUrl },
    select: { avatarUrl: true },
  });

  if (previous?.avatarUrl && previous.avatarUrl !== newUrl) {
    await deleteUploadedImage(previous.avatarUrl);
  }

  return NextResponse.json({ ok: true, avatarUrl: user.avatarUrl });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const previous = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });

  if (previous?.avatarUrl) {
    await deleteUploadedImage(previous.avatarUrl);
  }

  return NextResponse.json({ ok: true });
}
