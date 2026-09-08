import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ConcurrencyConflictError } from "@/lib/assessmentResults";

type UpdateEvaluationRemarksInput = {
  evaluationId: string;
  newRemarks: string;
  changedByUserId: string;
  /**
   * H3 — the version the caller last saw for this evaluation. Required
   * so a correction can never silently overwrite a change it never saw
   * — see ConcurrencyConflictError (src/lib/assessmentResults.ts),
   * reused here rather than duplicated since this is the exact same
   * optimistic-lock conflict on a sibling model.
   */
  expectedVersion: number;
};

/**
 * The only code path allowed to change an existing StudentEvaluation
 * row's remarks. While the evaluation is still fully private
 * (visibleToParent AND visibleToStudent both false), this is a plain
 * update — no audit row, matching the "creation/drafting isn't a
 * decision" reasoning used elsewhere in this schema. Once it has been
 * shared with EITHER audience, every subsequent edit instead updates
 * the row AND inserts a StudentEvaluationAudit row capturing the full
 * previous/new remarks, in the same transaction — so previously shared
 * information can never be silently rewritten.
 *
 * H3 — the update itself is now an optimistic-lock compare-and-swap,
 * the same mechanism and reasoning as correctComponentResult()
 * (src/lib/assessmentResults.ts): client.studentEvaluation.updateMany()
 * only affects a row whose version still equals input.expectedVersion
 * (read fresh, inside this same transaction, immediately above), and
 * bumps version by exactly 1 when it does. A concurrent edit that
 * already won means updateMany() affects 0 rows, so this throws
 * ConcurrencyConflictError instead of silently proceeding — and since
 * the whole thing is one transaction, neither the version bump nor the
 * audit row below is ever committed for the losing attempt.
 */
export async function updateEvaluationRemarks(
  input: UpdateEvaluationRemarksInput,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.studentEvaluation.findUniqueOrThrow({
      where: { id: input.evaluationId },
    });

    const casResult = await client.studentEvaluation.updateMany({
      where: { id: input.evaluationId, version: input.expectedVersion },
      data: { remarks: input.newRemarks, version: { increment: 1 } },
    });
    if (casResult.count !== 1) {
      throw new ConcurrencyConflictError(
        "This evaluation was changed by someone else in the meantime — please refresh and try again."
      );
    }
    // updateMany() only ever returns a count, never the row — but its
    // count === 1 above already proves the row was still exactly
    // `current` (version input.expectedVersion) the instant this write
    // applied, so the post-write shape is fully known without a second
    // read.
    const evaluation = { ...current, remarks: input.newRemarks, version: current.version + 1 };

    const wasShared = current.visibleToParent || current.visibleToStudent;
    let audit = null;
    if (wasShared) {
      audit = await client.studentEvaluationAudit.create({
        data: {
          evaluationId: input.evaluationId,
          changedByUserId: input.changedByUserId,
          previousRemarks: current.remarks,
          newRemarks: input.newRemarks,
        },
      });
    }

    return { evaluation, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}

type ShareEvaluationInput = {
  evaluationId: string;
  audience: "PARENT" | "STUDENT";
};

/**
 * Flips visibleToParent or visibleToStudent to true and stamps the
 * matching sharedWithXAt timestamp — a one-way action in this phase
 * (no un-share path), the same "permanent once released" precedent as
 * Certificate issuance elsewhere in this schema. Idempotent: sharing an
 * already-shared audience again is a no-op, not an error.
 */
export async function shareEvaluation(input: ShareEvaluationInput) {
  const now = new Date();
  if (input.audience === "PARENT") {
    return prisma.studentEvaluation.update({
      where: { id: input.evaluationId },
      data: { visibleToParent: true, sharedWithParentAt: now },
    });
  }
  return prisma.studentEvaluation.update({
    where: { id: input.evaluationId },
    data: { visibleToStudent: true, sharedWithStudentAt: now },
  });
}
