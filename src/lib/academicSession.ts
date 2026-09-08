import { NextResponse } from "next/server";
import { Prisma, AcademicSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { carryForwardEligibleStudents } from "@/lib/gradeRollover";

/**
 * C2 — the single, authoritative place AcademicSession.status is ever
 * written. Both the plain-create route (academic-sessions/route.ts) and
 * the rollover route (academic-sessions/rollover/route.ts) call
 * transitionAcademicSession() exclusively — neither ever touches
 * AcademicSession.status directly. See docs/PRODUCT_RULES.md /
 * schema.prisma's own AcademicSession comment for the underlying "at
 * most one ACTIVE session per school" invariant this enforces.
 *
 * Verified empirically (not assumed) against this repository's actual
 * SQLite configuration (journal_mode=delete, busy_timeout=5000,
 * Prisma 5.20/file:./dev.db) that wrapping a fresh existence-check and
 * the subsequent write inside ONE prisma.$transaction() is genuinely
 * race-safe here: a second concurrent transaction attempting the same
 * operation does not even begin executing its own read until the first
 * has fully committed — confirmed across concurrent same-process calls,
 * an explicitly widened connection pool, and two fully separate OS
 * processes racing the same SQLite file. The one part of the OLD code
 * that was NOT safe — and the actual bug this fixes — was a read taken
 * BEFORE the transaction started (see the rollover route's old
 * `priorSession` lookup); that stale read let two concurrent rollovers
 * each independently believe they were closing the one true active
 * session, producing two.
 */
export class AcademicSessionTransitionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type AcademicSessionTransitionResult = {
  session: AcademicSession;
  /** True only for CREATE_IF_NONE_ACTIVE, when a session already existed and nothing was written. */
  wasAlreadyActive: boolean;
  /** The session that was closed, if this transition was a rollover. */
  priorSessionId: string | null;
  /** Carry-forward count, only set when a rollover actually ran. */
  placed: number | null;
};

type CreateIfNoneActiveInput = {
  mode: "CREATE_IF_NONE_ACTIVE";
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
};

type RolloverInput = {
  mode: "ROLLOVER";
  schoolId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  /**
   * The session the caller currently believes is ACTIVE — from a read
   * that happened before this call (e.g. the route's own request-time
   * lookup, itself derived from a page render before that). Never
   * trusted directly: transitionAcademicSession() re-reads the real
   * current ACTIVE session fresh, inside its own transaction, and
   * requires this to match before closing anything. null means the
   * caller believes there is currently no active session at all.
   */
  expectedPriorSessionId: string | null;
};

export type AcademicSessionTransitionInput = CreateIfNoneActiveInput | RolloverInput;

/**
 * The one function allowed to change AcademicSession.status.
 *
 * CREATE_IF_NONE_ACTIVE: if a session is already ACTIVE for this school
 * (checked fresh, inside this call's own transaction — never a value
 * read before this function was called), that existing session is
 * returned as-is (wasAlreadyActive: true) and nothing is written —
 * matching the route's existing "don't create a duplicate" behavior.
 * Otherwise a new ACTIVE session is created, with no carry-forward
 * (there is nothing to carry forward from — this is the school's first
 * session).
 *
 * ROLLOVER: re-reads the real current ACTIVE session inside this same
 * transaction and requires it to match expectedPriorSessionId exactly.
 * A mismatch (including "expected a session but none exists now", or
 * "expected none but one now exists") throws AcademicSessionTransitionError
 * rather than silently closing/creating against stale state — this is
 * the actual fix for the race the old code had, where a concurrent
 * second rollover could close an already-closed/already-superseded
 * session and still create a second new ACTIVE session. Only on a
 * match does it close the prior session, create the new one, and carry
 * forward every eligible student — all still inside the one transaction.
 */
export async function transitionAcademicSession(
  input: AcademicSessionTransitionInput
): Promise<AcademicSessionTransitionResult> {
  return prisma.$transaction(async (tx) => {
    const currentActive = await tx.academicSession.findFirst({
      where: { schoolId: input.schoolId, status: "ACTIVE" },
    });

    if (input.mode === "CREATE_IF_NONE_ACTIVE") {
      if (currentActive) {
        return { session: currentActive, wasAlreadyActive: true, priorSessionId: null, placed: null };
      }
      const created = await tx.academicSession.create({
        data: {
          schoolId: input.schoolId,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          status: "ACTIVE",
        },
      });
      return { session: created, wasAlreadyActive: false, priorSessionId: null, placed: null };
    }

    // mode === "ROLLOVER"
    if (!currentActive) {
      throw new AcademicSessionTransitionError(400, "No active session to close. Complete Initial Setup first.");
    }
    if (currentActive.id !== input.expectedPriorSessionId) {
      throw new AcademicSessionTransitionError(
        409,
        "This school's active session has changed since this action was requested — please refresh and try again."
      );
    }

    await tx.academicSession.update({ where: { id: currentActive.id }, data: { status: "CLOSED" } });
    const created = await tx.academicSession.create({
      data: {
        schoolId: input.schoolId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "ACTIVE",
      },
    });
    const { placed } = await carryForwardEligibleStudents(input.schoolId, created.id, tx);
    return { session: created, wasAlreadyActive: false, priorSessionId: currentActive.id, placed };
  });
}

/**
 * Shared error-to-response mapping for both academic-session routes.
 * AcademicSessionTransitionError carries its own intended status.
 * SQLITE_BUSY / Prisma's P2034 ("Transaction failed due to a write
 * conflict... Please retry") means a concurrent transition was genuinely
 * still holding the write lock when this one's busy_timeout expired —
 * a real but rare contention case under this school's own traffic, not
 * a bug — surfaced as a clear, retryable 503 rather than a raw 500.
 * Anything else is rethrown, never swallowed.
 */
export function academicSessionTransitionErrorResponse(err: unknown): NextResponse {
  if (err instanceof AcademicSessionTransitionError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") ||
    (err instanceof Error && /database is locked|SQLITE_BUSY/i.test(err.message))
  ) {
    return NextResponse.json(
      { error: "This school's session data is being updated by another request right now — please try again in a moment." },
      { status: 503 }
    );
  }
  throw err;
}
