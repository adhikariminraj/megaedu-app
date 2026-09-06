import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoAccountEmail } from "@/lib/demoAccount";

// Self-service only — a user changes their own password, never someone
// else's. Same inline session-derived userId check every other
// self-service write in this codebase uses (see /api/user/avatar) —
// there is no requireX() helper for "acting on your own User row"
// because nothing has needed one before this. userId is never accepted
// from the request body/query; it only ever comes from the
// authenticated session.
//
// MEGA ID / roles / institutional affiliations are untouched by this
// route entirely — it writes exactly one column (User.passwordHash) on
// the same User row every registration route already hashes into with
// bcrypt.hash(password, 10); nothing else on User, Teacher, Student,
// Parent, or any affiliation table is read or written here.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your current password and a new password of at least 8 characters." },
      { status: 400 }
    );
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (!user) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  // Seeded demo accounts share one documented, stable password
  // (see DEMO_DATA.md) that future testers rely on — this route must
  // never touch a demo account's passwordHash, checked before any
  // verification/hashing happens, never just hidden in the UI.
  if (isDemoAccountEmail(user.email)) {
    return NextResponse.json(
      { error: "Password changes are not available for demo accounts." },
      { status: 403 }
    );
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });

  return NextResponse.json({ ok: true });
}
