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
import { runWithConcurrencyLimit } from "@/lib/concurrency";

/**
 * Bulk completion save — how many recordOrCorrectCompletion() calls (each
 * its own independent prisma.$transaction()) may be in flight at once.
 * SQLite allows only one writer at a time, and Prisma's interactive-
 * transaction default timeout is 5000ms — fire too many transactions at
 * once and the ones stuck waiting for the SQLite write lock past that
 * window fail with a P1008 timeout, not a graceful conflict. Empirically
 * benchmarked against this repository's actual dev.db (not guessed):
 * unbounded concurrency fails routinely at just 12 rows (5/12 succeeded);
 * a limit of 8 still collapses catastrophically at realistic class sizes
 * (16/60 succeeded); limits of 3 and 5 were both 100% reliable up to 60
 * rows (well beyond MEGA's largest real class sizes, ~30-35 students) at
 * comparable elapsed time. 5 was chosen for a little more throughput
 * headroom than 3 while staying well clear of the failure cliff at 8.
 */
const COMPLETION_SAVE_CONCURRENCY = 5;

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

type RowOutcome = { applicabilityId: string; ok: true; version: number } | { applicabilityId: string; ok: false; error: string };

/**
 * POST — bulk-record/correct completion in one request, so a teacher
 * checking a whole section's notebooks doesn't need one page load per
 * student. Each record is applied through its OWN independent
 * recordOrCorrectCompletion() transaction — deliberately NOT one
 * all-or-nothing transaction across the whole batch, since one student's
 * completion is entirely unrelated to another's; a stale-version
 * conflict (or any other single-row failure — see below) must never
 * discard the other rows' legitimate writes. Returns a per-row outcome
 * so the client can show exactly which rows saved and which need a
 * refresh.
 *
 * Concurrency is bounded to COMPLETION_SAVE_CONCURRENCY in-flight
 * transactions at once (see that constant's own comment for the
 * empirical reasoning) — this is throughput/reliability tuning only, it
 * changes nothing about per-row atomicity or CAS semantics.
 *
 * EVERY row failure — a genuine HomeworkCompletionConflictError (CAS
 * lost the race) or any other unexpected error (e.g. a transient
 * database error) — becomes that row's own {ok:false} outcome. Nothing
 * is ever re-thrown out of the per-row handler: doing so would reject
 * the whole batch and discard the results of every row that already
 * succeeded, which is exactly the bug this route previously had. The
 * response is therefore always valid JSON with a 200 status, regardless
 * of how many individual rows failed — success/failure is communicated
 * entirely through each row's own `ok` flag, never through the HTTP
 * status of the batch as a whole.
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

  const settled = await runWithConcurrencyLimit(parsed.data.records, COMPLETION_SAVE_CONCURRENCY, async (record) => {
    if (!validIds.has(record.applicabilityId)) {
      const outcome: RowOutcome = { applicabilityId: record.applicabilityId, ok: false, error: "Not found for this homework." };
      return outcome;
    }
    try {
      const { completion } = await recordOrCorrectCompletion({
        homeworkApplicabilityId: record.applicabilityId,
        status: record.status,
        teacherId,
        expectedVersion: record.expectedVersion,
      });
      const outcome: RowOutcome = { applicabilityId: record.applicabilityId, ok: true, version: completion.version };
      return outcome;
    } catch (err) {
      if (err instanceof HomeworkCompletionConflictError) {
        const outcome: RowOutcome = { applicabilityId: record.applicabilityId, ok: false, error: err.message };
        return outcome;
      }
      // Any other failure (e.g. a transient database error) must also
      // become this row's own explicit outcome — never escape and take
      // down the whole batch response. Logged server-side for
      // visibility; the client sees a generic, safe message rather than
      // a raw internal error string.
      console.error(`Homework completion save failed for applicability ${record.applicabilityId}:`, err);
      const outcome: RowOutcome = { applicabilityId: record.applicabilityId, ok: false, error: "Could not save this row — please try again." };
      return outcome;
    }
  });

  // runWithConcurrencyLimit() itself never rejects a settled entry for
  // the function above, since every path inside it already returns a
  // RowOutcome rather than throwing — but unwrap defensively via the
  // PromiseSettledResult shape regardless, so a future change to the
  // callback above can never silently reintroduce the original bug of
  // one row's uncaught exception rejecting the whole batch response.
  const outcomes: RowOutcome[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { applicabilityId: parsed.data.records[i].applicabilityId, ok: false, error: "Could not save this row — please try again." }
  );

  return NextResponse.json({ ok: true, results: outcomes });
}
