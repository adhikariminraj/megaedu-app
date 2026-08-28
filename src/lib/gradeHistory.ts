import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const GRADE_HISTORY_STATUSES = [
  "ENROLLED",
  "COMPLETED",
  "REPEATED",
  "TRANSFERRED",
  "LEFT",
] as const;
export type GradeHistoryStatus = (typeof GRADE_HISTORY_STATUSES)[number];

type RecordGradeDecisionInput = {
  gradeHistoryId: string;
  newStatus: GradeHistoryStatus;
  newOutcomeGradeId?: string | null;
  changedByUserId: string;
};

/**
 * The only code path anywhere in the app allowed to change a
 * GradeHistory row's status/outcomeGradeId. Every write — including the
 * very first decision recorded on a row, not just later corrections —
 * updates the row and inserts a matching GradeHistoryAudit row in the
 * same transaction, so it's structurally impossible to change a
 * decision without leaving a record.
 *
 * This is a low-level primitive: it doesn't enforce which status
 * transitions make sense for a given feature (e.g. "only promote
 * currently-ENROLLED students") — that's the calling route's job. It
 * only guarantees the write+audit pairing is atomic and universal.
 *
 * Accepts an optional transaction client (`tx`) so a caller that needs
 * several related writes to be atomic together (e.g. a bulk promotion
 * across many students) can pass the callback argument from
 * prisma.$transaction(async (tx) => {...}) instead of letting this
 * function open its own.
 */
export async function recordGradeDecision(
  input: RecordGradeDecisionInput,
  tx?: Prisma.TransactionClient
) {
  if (!GRADE_HISTORY_STATUSES.includes(input.newStatus)) {
    throw new Error(`Invalid GradeHistory status: ${input.newStatus}`);
  }

  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.gradeHistory.findUniqueOrThrow({
      where: { id: input.gradeHistoryId },
    });

    const gradeHistory = await client.gradeHistory.update({
      where: { id: input.gradeHistoryId },
      data: {
        status: input.newStatus,
        outcomeGradeId: input.newOutcomeGradeId ?? null,
        decidedAt: new Date(),
        decidedByUserId: input.changedByUserId,
      },
    });

    const audit = await client.gradeHistoryAudit.create({
      data: {
        gradeHistoryId: input.gradeHistoryId,
        changedByUserId: input.changedByUserId,
        previousStatus: current.status,
        previousOutcomeGradeId: current.outcomeGradeId,
        newStatus: input.newStatus,
        newOutcomeGradeId: input.newOutcomeGradeId ?? null,
      },
    });

    return { gradeHistory, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
