import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacherAssignment } from "@/lib/authorize";
import { resolveSubjectTeacherAuthorizationScope } from "@/lib/homeworkAuthorization";
import {
  recordOrCorrectCompletion,
  HomeworkCompletionConflictError,
  HOMEWORK_COMPLETION_STATUSES,
} from "@/lib/homeworkCompletion";
import { computeHomeworkRollup } from "@/lib/homeworkRollup";

/**
 * K2 — resolves whether the current session's Teacher may record/view
 * completion for this Homework, and returns their Teacher.id if so.
 * Deliberately Teacher-only — no requireSchoolAdmin() composition, per
 * the explicit K2 authorization decision: Class Teacher/Grade
 * Coordinator/School Admin must not gain authority over individual
 * Homework completion merely because they can administer the school.
 *
 * Regular Homework: authorized against the Homework's OWN frozen scope
 * (schoolGradeId/sectionId/subjectId) — the same requireTeacherAssignment()
 * call the PATCH route already uses, re-verified fresh, never an
 * ownership/creator lock.
 *
 * Individual Homework: Homework.sectionId is always null (K1 design),
 * which must NOT be read as "any section is authorized" nor as "only a
 * grade-wide teacher is authorized." Per the K2 authorization
 * clarification: freshly resolve the target student's placement WITHIN
 * THIS HOMEWORK'S OWN academicSessionId/schoolGradeId (never the
 * school's currently-ACTIVE session, which could be a different, later
 * session by the time completion is recorded) via
 * resolveStudentPlacementInSession(). If found, authorize against that
 * student's CURRENT section (grade-wide OR that exact section) — so a
 * section-specific-only teacher of a DIFFERENT section is correctly
 * rejected, and authorization follows the student if they've since
 * transferred sections. If the student has since transferred out of
 * this grade or left the school entirely (no current-roster placement),
 * fall back to requiring a grade-wide assignment specifically — a
 * teacher whose assignment was only ever section-specific has no
 * remaining basis to record for a student no longer anywhere in this
 * grade. This NEVER rewrites or re-derives HomeworkApplicability itself
 * — only the live authorization check's own scope input is resolved
 * fresh, the same way every other requireTeacherAssignment() caller in
 * this codebase always checks CURRENT institutional state, never a
 * frozen snapshot.
 */
async function resolveCompletionAuthorization(
  schoolId: string,
  homework: { academicSessionId: string; schoolGradeId: string; sectionId: string | null; subjectId: string; targetStudentId: string | null }
): Promise<string | null> {
  const sectionId = await resolveSubjectTeacherAuthorizationScope(homework);

  const userId = await requireTeacherAssignment(schoolId, {
    academicSessionId: homework.academicSessionId,
    schoolGradeId: homework.schoolGradeId,
    sectionId,
    subjectId: homework.subjectId,
  });
  if (!userId) return null;

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  return teacher?.id ?? null;
}

async function loadAuthorizedHomework(schoolId: string, homeworkId: string) {
  const homework = await prisma.homework.findUnique({ where: { id: homeworkId } });
  if (!homework) return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) } as const;

  const schoolGrade = await prisma.schoolGrade.findUnique({ where: { id: homework.schoolGradeId } });
  if (!schoolGrade || schoolGrade.schoolId !== schoolId) {
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) } as const;
  }

  if (homework.status !== "PUBLISHED") {
    return {
      error: NextResponse.json({ error: "This homework has not been published yet." }, { status: 409 }),
    } as const;
  }

  const teacherId = await resolveCompletionAuthorization(schoolId, homework);
  if (!teacherId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;

  return { homework, teacherId } as const;
}

/**
 * GET — the current roster of HomeworkApplicability rows for this
 * Homework, each with its current HomeworkCompletion (or null =
 * unrecorded), plus (K5) a summary rollup and (K3/K4) per-student
 * submission/review counts — Teacher-only, no Class Teacher/Grade
 * Coordinator/School Admin progress-visibility surface here (that's
 * the separate, deliberately deferred-scope .../homework/progress
 * page). The rollup is included ONLY for Regular Homework
 * (targetStudentId: null) — an Individual Homework's single applicable
 * student has no meaningful "class completion percentage," per the
 * hard Regular/Individual separation rule, so `rollup` is null and
 * `isIndividual` is true instead.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; homeworkId: string } }
) {
  const result = await loadAuthorizedHomework(params.id, params.homeworkId);
  if ("error" in result) return result.error;
  const { homework } = result;

  const applicability = await prisma.homeworkApplicability.findMany({
    where: { homeworkId: params.homeworkId },
    include: {
      student: { select: { fullName: true } },
      completion: { include: { recordedByTeacher: { select: { fullName: true } } } },
      _count: { select: { submissionAttempts: true, reviews: true } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return NextResponse.json({
    ok: true,
    isIndividual: !!homework.targetStudentId,
    rollup: homework.targetStudentId ? null : await computeHomeworkRollup(params.homeworkId),
    students: applicability.map((a) => ({
      applicabilityId: a.id,
      studentId: a.studentId,
      studentName: a.student.fullName,
      status: a.completion?.status ?? null,
      version: a.completion?.version ?? null,
      recordedAt: a.completion?.recordedAt.toISOString() ?? null,
      recordedByTeacherName: a.completion?.recordedByTeacher.fullName ?? null,
      submissionCount: a._count.submissionAttempts,
      reviewCount: a._count.reviews,
    })),
  });
}

const recordSchema = z.object({
  applicabilityId: z.string().min(1),
  status: z.enum(HOMEWORK_COMPLETION_STATUSES),
  expectedVersion: z.number().int().nullable(),
});
const postSchema = z.object({ records: z.array(recordSchema).min(1).max(500) });

/**
 * POST — bulk-record/correct completion in one request, so a teacher
 * checking a whole section's notebooks doesn't need one page load per
 * student. Each record is applied through its OWN independent
 * recordOrCorrectCompletion() transaction — deliberately NOT one
 * all-or-nothing transaction across the whole batch, since one student's
 * completion is entirely unrelated to another's; a stale-version
 * conflict on one row must never discard the other rows' legitimate
 * writes. Returns a per-row outcome so the client can show exactly which
 * rows saved and which need a refresh.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; homeworkId: string } }
) {
  const result = await loadAuthorizedHomework(params.id, params.homeworkId);
  if ("error" in result) return result.error;
  const { teacherId } = result;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Defense in depth: every applicabilityId submitted must actually
  // belong to THIS homeworkId — never trust a client-supplied id in
  // isolation, matching the create route's own validation shape.
  const applicabilityIds = parsed.data.records.map((r) => r.applicabilityId);
  const validApplicability = await prisma.homeworkApplicability.findMany({
    where: { id: { in: applicabilityIds }, homeworkId: params.homeworkId },
    select: { id: true },
  });
  const validIds = new Set(validApplicability.map((a) => a.id));

  const outcomes = await Promise.all(
    parsed.data.records.map(async (record) => {
      if (!validIds.has(record.applicabilityId)) {
        return { applicabilityId: record.applicabilityId, ok: false as const, error: "Not found for this homework." };
      }
      try {
        const { completion } = await recordOrCorrectCompletion({
          homeworkApplicabilityId: record.applicabilityId,
          status: record.status,
          teacherId,
          expectedVersion: record.expectedVersion,
        });
        return { applicabilityId: record.applicabilityId, ok: true as const, version: completion.version };
      } catch (err) {
        if (err instanceof HomeworkCompletionConflictError) {
          return { applicabilityId: record.applicabilityId, ok: false as const, error: err.message };
        }
        throw err;
      }
    })
  );

  return NextResponse.json({ ok: true, results: outcomes });
}
