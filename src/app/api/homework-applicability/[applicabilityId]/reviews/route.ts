import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveApplicabilityAccess } from "@/lib/homeworkAuthorization";
import { createReview, HomeworkReviewValidationError } from "@/lib/homeworkReview";

async function loadApplicabilityForAccess(applicabilityId: string) {
  return prisma.homeworkApplicability.findUnique({
    where: { id: applicabilityId },
    include: { homework: { include: { schoolGrade: true } } },
  });
}

/**
 * K4 — GET returns this applicability's full review/feedback history
 * (immediately visible, no private-until-shared gate — an explicit,
 * approved v1 decision) to any of the three authorized roles (Student,
 * Parent, authorized Subject Teacher).
 */
export async function GET(req: NextRequest, { params }: { params: { applicabilityId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applicability = await loadApplicabilityForAccess(params.applicabilityId);
  if (!applicability) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const access = await resolveApplicabilityAccess(userId, applicability, applicability.homework.schoolGrade.schoolId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reviews = await prisma.homeworkReview.findMany({
    where: { homeworkApplicabilityId: params.applicabilityId },
    include: { reviewedByTeacher: { select: { fullName: true } } },
    orderBy: { reviewNumber: "asc" },
  });

  return NextResponse.json({
    ok: true,
    reviews: reviews.map((r) => ({
      id: r.id,
      reviewNumber: r.reviewNumber,
      feedback: r.feedback,
      reviewedByTeacherName: r.reviewedByTeacher.fullName,
      reviewedAt: r.reviewedAt.toISOString(),
      submissionAttemptId: r.submissionAttemptId,
    })),
  });
}

const postSchema = z.object({
  feedback: z.string().trim().min(1).max(4000),
  submissionAttemptId: z.string().min(1).nullable().optional(),
});

/**
 * K4 — POST creates a new, append-only review entry. Subject Teacher
 * only (resolveApplicabilityAccess() role "TEACHER") — reuses K2's
 * exact, unmodified authorization rule. No Admin/Class Teacher/Grade
 * Coordinator bypass. submissionAttemptId, when given, is verified to
 * actually belong to this same applicability — never trusted from the
 * client in isolation, matching this codebase's standard validation
 * shape.
 */
export async function POST(req: NextRequest, { params }: { params: { applicabilityId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applicability = await loadApplicabilityForAccess(params.applicabilityId);
  if (!applicability) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const access = await resolveApplicabilityAccess(userId, applicability, applicability.homework.schoolGrade.schoolId);
  if (!access || access.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.submissionAttemptId) {
    const attempt = await prisma.homeworkSubmissionAttempt.findUnique({
      where: { id: parsed.data.submissionAttemptId },
    });
    if (!attempt || attempt.homeworkApplicabilityId !== params.applicabilityId) {
      return NextResponse.json({ error: "Invalid submission attempt." }, { status: 400 });
    }
  }

  try {
    const review = await createReview({
      homeworkApplicabilityId: params.applicabilityId,
      reviewedByTeacherId: access.teacherId,
      feedback: parsed.data.feedback,
      submissionAttemptId: parsed.data.submissionAttemptId,
    });
    return NextResponse.json({ ok: true, review: { id: review.id, reviewNumber: review.reviewNumber } });
  } catch (err) {
    if (err instanceof HomeworkReviewValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
