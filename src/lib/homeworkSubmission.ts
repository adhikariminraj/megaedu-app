import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Thrown when a submission attempt fails validation (e.g. neither text nor a file was provided). Maps to HTTP 400. */
export class HomeworkSubmissionValidationError extends Error {}

/**
 * K3 — the only code path allowed to create a HomeworkSubmissionAttempt.
 * Attempts are immutable and append-only; there is no correction path —
 * a resubmission is simply another call to this function. attemptNumber
 * is resolved fresh, inside this same transaction, from the current
 * count for this applicability (never trusted from a stale client read)
 * — the same "current count + 1" idiom already used by TeachingUnit's
 * own order field. The @@unique([homeworkApplicabilityId, attemptNumber])
 * constraint is the database-level backstop behind this, exactly the
 * same "belt and suspenders" relationship already used throughout this
 * schema (HomeworkApplicability's own unique constraint behind
 * publishHomework(), HomeworkCompletion's behind its CAS guard).
 *
 * isLate is derived once here, from submittedAt vs. the parent
 * Homework's own dueDate (already frozen post-publish) — never
 * recomputed live afterward.
 *
 * At least one of textContent/filePath is required — enforced here,
 * not left to the caller, since this is the one place a submission
 * attempt is ever created.
 */
export async function createSubmissionAttempt(
  input: {
    homeworkApplicabilityId: string;
    submittedByUserId: string;
    textContent: string | null;
    filePath: string | null;
  },
  tx?: Prisma.TransactionClient
) {
  if (!input.textContent?.trim() && !input.filePath) {
    throw new HomeworkSubmissionValidationError("A submission must include text and/or a file.");
  }

  const run = async (client: Prisma.TransactionClient) => {
    const applicability = await client.homeworkApplicability.findUniqueOrThrow({
      where: { id: input.homeworkApplicabilityId },
      include: { homework: true },
    });

    const existingCount = await client.homeworkSubmissionAttempt.count({
      where: { homeworkApplicabilityId: input.homeworkApplicabilityId },
    });

    const submittedAt = new Date();
    const isLate = submittedAt.getTime() > applicability.homework.dueDate.getTime();

    return client.homeworkSubmissionAttempt.create({
      data: {
        homeworkApplicabilityId: input.homeworkApplicabilityId,
        attemptNumber: existingCount + 1,
        submittedAt,
        isLate,
        textContent: input.textContent?.trim() || null,
        filePath: input.filePath,
        submittedByUserId: input.submittedByUserId,
      },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
