import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Thrown when review creation fails validation (e.g. empty feedback text). Maps to HTTP 400. */
export class HomeworkReviewValidationError extends Error {}

/**
 * K4 — the only code path allowed to create a HomeworkReview. Reviews
 * are immutable and append-only, exactly like HomeworkSubmissionAttempt
 * — there is no correction path; a later, better-worded piece of
 * feedback is simply another call to this function, never an edit to an
 * earlier one, per the explicit "do not overwrite previous feedback"
 * product decision. reviewNumber is resolved fresh, inside this same
 * transaction, from the current count for this applicability (never
 * trusted from a stale client read) — the same idiom already used by
 * createSubmissionAttempt()'s attemptNumber. The
 * @@unique([homeworkApplicabilityId, reviewNumber]) constraint is the
 * database-level backstop behind this.
 *
 * submissionAttemptId is optional and purely informational — a review
 * may exist for a purely offline-checked homework with zero online
 * submissions ever recorded, and this function does not require or
 * validate that the referenced attempt (when given) even belongs to the
 * same applicability beyond what the caller (the route) has already
 * verified.
 */
export async function createReview(
  input: {
    homeworkApplicabilityId: string;
    reviewedByTeacherId: string;
    feedback: string;
    submissionAttemptId?: string | null;
  },
  tx?: Prisma.TransactionClient
) {
  const feedback = input.feedback.trim();
  if (!feedback) {
    throw new HomeworkReviewValidationError("Feedback text is required.");
  }

  const run = async (client: Prisma.TransactionClient) => {
    const existingCount = await client.homeworkReview.count({
      where: { homeworkApplicabilityId: input.homeworkApplicabilityId },
    });

    return client.homeworkReview.create({
      data: {
        homeworkApplicabilityId: input.homeworkApplicabilityId,
        reviewNumber: existingCount + 1,
        feedback,
        reviewedByTeacherId: input.reviewedByTeacherId,
        submissionAttemptId: input.submissionAttemptId ?? null,
      },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
