import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type UpdateEvaluationRemarksInput = {
  evaluationId: string;
  newRemarks: string;
  changedByUserId: string;
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
 */
export async function updateEvaluationRemarks(
  input: UpdateEvaluationRemarksInput,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.studentEvaluation.findUniqueOrThrow({
      where: { id: input.evaluationId },
    });

    const evaluation = await client.studentEvaluation.update({
      where: { id: input.evaluationId },
      data: { remarks: input.newRemarks },
    });

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
