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
        // A status decision never itself changes section — echo the
        // row's current (unchanged) section into both columns so this
        // audit row is still a complete before/after snapshot, not a
        // half-empty one. See reassignSection() below for the path that
        // actually changes section.
        previousSectionId: current.sectionId,
        newStatus: input.newStatus,
        newOutcomeGradeId: input.newOutcomeGradeId ?? null,
        newSectionId: current.sectionId,
      },
    });

    return { gradeHistory, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}

type ReassignSectionInput = {
  gradeHistoryId: string;
  newSectionId: string | null;
  changedByUserId: string;
};

/**
 * The only code path allowed to change sectionId on an EXISTING
 * GradeHistory row — whether filling in a previously-null section or
 * genuinely moving a student from one section to another. Deliberately
 * separate from recordGradeDecision(): a section change is not a
 * status/outcome decision, and promotion must never be conflated with
 * section assignment (a promoted student's new-session row starts with
 * no section at all — see gradeRollover.ts — and gets one only through
 * this function or at creation time).
 *
 * Like recordGradeDecision(), every call — including the first time a
 * section is ever set on a row — writes a full before/after
 * GradeHistoryAudit snapshot in the same transaction, so the section a
 * student was in at any point in the record is never lost. Setting the
 * section at row CREATION time (Initial Setup, manual placement,
 * rollover carry-forward) is not audited, matching the same "creation
 * isn't a decision" reasoning applied to status.
 */
export async function reassignSection(
  input: ReassignSectionInput,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.gradeHistory.findUniqueOrThrow({
      where: { id: input.gradeHistoryId },
    });

    const gradeHistory = await client.gradeHistory.update({
      where: { id: input.gradeHistoryId },
      data: { sectionId: input.newSectionId },
    });

    const audit = await client.gradeHistoryAudit.create({
      data: {
        gradeHistoryId: input.gradeHistoryId,
        changedByUserId: input.changedByUserId,
        previousStatus: current.status,
        previousOutcomeGradeId: current.outcomeGradeId,
        previousSectionId: current.sectionId,
        newStatus: current.status,
        newOutcomeGradeId: current.outcomeGradeId,
        newSectionId: input.newSectionId,
      },
    });

    return { gradeHistory, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
