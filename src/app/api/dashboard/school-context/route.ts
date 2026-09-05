import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifySchoolAccess, SCHOOL_CONTEXT_COOKIE } from "@/lib/institutionalContext";

/**
 * Persists the caller's remembered-school preference — a UX
 * convenience only, never itself a grant of access. Every subsequent
 * page/route that reads this cookie re-verifies it via
 * verifySchoolAccess() before relying on it for anything.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { schoolId } = await req.json();
  if (!schoolId || typeof schoolId !== "string") {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  // Sanity check only, not a security boundary — avoids storing a
  // preference for a school the person has no relationship with at
  // all, but the real check happens again on every use of the cookie.
  const access = await verifySchoolAccess(userId, schoolId);
  if (!access) return NextResponse.json({ error: "Not accessible." }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SCHOOL_CONTEXT_COOKIE, schoolId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
