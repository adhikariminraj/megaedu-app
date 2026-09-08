import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const HOMEWORK_COMPLETION_STATUSES = ["COMPLETED", "PARTIAL", "NOT_COMPLETED", "EXCUSED"] as const;
export type HomeworkCompletionStatus = (typeof HOMEWORK_COMPLETION_STATUSES)[number];

// K4 — the Individual-Homework authorization-scope rule that used to
// live here moved to src/lib/homeworkAuthorization.ts
// (resolveSubjectTeacherAuthorizationScope) — mechanical rename/
// relocation only, semantics unchanged — since K4 Review now reuses the
// identical rule and it no longer belongs to Completion specifically.

/**
 * K2 — thrown when a completion recording/correction can't be applied as
 * requested: either the caller's expectedVersion no longer matches
 * reality (another teacher's write won the race in between), or the
 * caller's belief about whether a row already exists is stale (expected
 * none, but one now exists — or expected one, but somehow none does).
 * Always maps to HTTP 409 at the calling route.
 */
export class HomeworkCompletionConflictError extends Error {}

type RecordOrCorrectCompletionInput = {
  homeworkApplicabilityId: string;
  status: HomeworkCompletionStatus;
  teacherId: string;
  /**
   * The version the caller last saw for this HomeworkApplicability's
   * completion, or null if the caller believes no HomeworkCompletion
   * row exists yet. Required so a correction can never silently
   * overwrite a change it never saw, and so a "first recording" can
   * never silently overwrite a first recording someone else already
   * made in the meantime.
   */
  expectedVersion: number | null;
};

/**
 * The only code path allowed to create or change a HomeworkCompletion
 * row. One HomeworkApplicability has at most one CURRENT
 * HomeworkCompletion row (update-in-place), with every correction after
 * the first recording paired with a HomeworkCompletionAudit row in the
 * same transaction — mirroring correctAttendance()'s exact shape. The
 * FIRST recording is never audited (creation isn't a correction, the
 * same reasoning already applied to GradeHistoryAudit/
 * StudentEvaluationAudit).
 *
 * K2 — optimistic-lock CAS, the same H3 pattern already proven for
 * AssessmentComponentResult, adopted deliberately here (not by default)
 * because TeacherAcademicAssignment explicitly permits more than one
 * teacher to hold an overlapping assignment for the same subject/grade/
 * section, making a genuine two-teacher race a real scenario for
 * Homework specifically — see the model comment on HomeworkCompletion
 * (schema.prisma). Four cases:
 *   - no existing row + expectedVersion null    -> create (first record)
 *   - no existing row + expectedVersion not null -> conflict (stale: the
 *     caller expected a row that isn't there)
 *   - existing row + expectedVersion null        -> conflict (someone
 *     else already made the first recording since the caller last saw
 *     this)
 *   - existing row + expectedVersion matches      -> CAS update + audit
 *   - existing row + expectedVersion doesn't match -> conflict
 * The @@unique constraint on HomeworkCompletion.homeworkApplicabilityId
 * is the database-level backstop behind the app-level guard above,
 * exactly the same "belt and suspenders" relationship
 * HomeworkApplicability's own unique constraint has to publishHomework()'s
 * fresh-status check.
 */
export async function recordOrCorrectCompletion(
  input: RecordOrCorrectCompletionInput,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    const existing = await client.homeworkCompletion.findUnique({
      where: { homeworkApplicabilityId: input.homeworkApplicabilityId },
    });

    if (!existing) {
      if (input.expectedVersion !== null) {
        throw new HomeworkCompletionConflictError(
          "This homework's completion record no longer matches what you saw — please refresh and try again."
        );
      }
      const recordedAt = new Date();
      let created;
      try {
        created = await client.homeworkCompletion.create({
          data: {
            homeworkApplicabilityId: input.homeworkApplicabilityId,
            status: input.status,
            recordedAt,
            recordedByTeacherId: input.teacherId,
          },
        });
      } catch (err) {
        // Database-level backstop: someone else's first recording won
        // the race in the instant between our findUnique() read and this
        // create() (should not happen given Prisma+SQLite's proven
        // transaction serialization, but never silently swallowed).
        throw new HomeworkCompletionConflictError(
          "This homework's completion was just recorded by someone else — please refresh and try again."
        );
      }
      return { completion: created, audit: null, created: true };
    }

    if (input.expectedVersion === null || input.expectedVersion !== existing.version) {
      throw new HomeworkCompletionConflictError(
        "This homework's completion record was changed by someone else in the meantime — please refresh and try again."
      );
    }

    const recordedAt = new Date();
    const cas = await client.homeworkCompletion.updateMany({
      where: { homeworkApplicabilityId: input.homeworkApplicabilityId, version: input.expectedVersion },
      data: {
        status: input.status,
        recordedAt,
        recordedByTeacherId: input.teacherId,
        version: { increment: 1 },
      },
    });
    if (cas.count !== 1) {
      throw new HomeworkCompletionConflictError(
        "This homework's completion record was changed by someone else in the meantime — please refresh and try again."
      );
    }

    const audit = await client.homeworkCompletionAudit.create({
      data: {
        homeworkCompletionId: existing.id,
        changedByTeacherId: input.teacherId,
        previousStatus: existing.status,
        newStatus: input.status,
      },
    });

    const updated = {
      ...existing,
      status: input.status,
      recordedAt,
      recordedByTeacherId: input.teacherId,
      version: existing.version + 1,
    };

    return { completion: updated, audit, created: false };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
