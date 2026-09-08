import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { transitionAcademicSession, academicSessionTransitionErrorResponse } from "@/lib/academicSession";

/**
 * Closes the school's current ACTIVE session and opens a new one, then
 * sweeps every eligible student (most recent decision was
 * COMPLETED/REPEATED with a real outcome grade) into the new session.
 * Anyone still ENROLLED with no decision is deliberately left
 * unplaced — never silently defaulted — and shows up in the persistent
 * Pending/Unresolved queue on /dashboard/grades until a School Admin
 * resolves them.
 *
 * C2: the close+create+carry-forward transition itself happens entirely
 * inside transitionAcademicSession() (src/lib/academicSession.ts), which
 * re-reads the real current ACTIVE session fresh, inside its own
 * transaction, and requires it to still match expectedPriorSession
 * below before touching anything. expectedPriorSession here is only
 * ever a hint used to detect staleness — never trusted as the actual
 * write target — so a second concurrent rollover request (a double
 * submit, or two admins racing) is rejected with a clear conflict
 * rather than silently closing an already-superseded session and
 * chaining a second, unintended rollover on top of the first.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Non-authoritative — purely this request's own belief about what's
  // currently active, used only as the expectation transitionAcademicSession()
  // verifies against its own fresh, in-transaction read below. Never
  // used directly as the id being closed.
  const expectedPriorSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (!expectedPriorSession) {
    return NextResponse.json(
      { error: "No active session to close. Complete Initial Setup first." },
      { status: 400 }
    );
  }

  const { name, startDate, endDate } = await req.json();
  if (!name?.trim() || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Session name, start date, and end date are all required." },
      { status: 400 }
    );
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 });
  }

  try {
    const result = await transitionAcademicSession({
      mode: "ROLLOVER",
      schoolId: params.id,
      name: name.trim(),
      startDate: start,
      endDate: end,
      expectedPriorSessionId: expectedPriorSession.id,
    });
    return NextResponse.json({ ok: true, session: result.session, placed: result.placed });
  } catch (err) {
    return academicSessionTransitionErrorResponse(err);
  }
}
