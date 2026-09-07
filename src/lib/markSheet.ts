import { prisma } from "@/lib/prisma";
import { fetchAssessmentResults, computeUnweightedGPA } from "@/lib/assessmentResults";
import { resolveCurrentPlacement, GRADE_HISTORY_STATUSES } from "@/lib/gradeHistory";

/**
 * Mark Sheet — the formal, immutable, issued ANNUAL result document.
 * See docs/MARK_SHEET.md and the MarkSheet/MarkSheetSubject model
 * comments in schema.prisma for the full product/architecture context.
 *
 * No new calculation engine exists here. The final annual result is
 * computed entirely by the existing assessment engine
 * (fetchAssessmentResults()/computeUnweightedGPA(), assessmentResults.ts)
 * — SubjectResult.subjectTotal already IS the whole-session subject
 * result, by construction of AssessmentFrameworkAssignment's
 * one-framework-per-subject-per-session uniqueness. The final
 * progression outcome is never decided here either — it is read from
 * the already-recorded GradeHistory decision (recordGradeDecision(),
 * gradeHistory.ts). This module's only job is to verify both are ready,
 * then freeze them.
 */

export type MarkSheetEligibility =
  | { eligible: true; schoolName: string; sessionName: string; gradeDisplayName: string; sectionName: string | null; outcomeStatus: string; subjectCount: number; gpa: number | null }
  | { eligible: false; reason: string };

type SnapshotResult = {
  placement: NonNullable<Awaited<ReturnType<typeof resolveCurrentPlacement>>>;
  school: { id: string; name: string };
  student: { id: string; fullName: string; megaId: string | null };
  outcomeGradeDisplayName: string | null;
  subjects: Awaited<ReturnType<typeof fetchAssessmentResults>>["subjects"];
  gpa: number | null;
};

/**
 * Read-only precondition check + data gather — shared by
 * checkMarkSheetEligibility() (used by the School Admin UI to preview
 * before issuing) and the two write paths below (which re-derive this
 * same data right before writing, since eligibility can change between
 * a page render and an admin's click).
 *
 * Uses audience "STAFF" deliberately — that's the one fetchAssessmentResults()
 * audience that returns every subject regardless of publication status,
 * which is exactly what's needed to tell "every subject is published"
 * apart from "some subjects simply have no results yet." Audience
 * "STUDENT"/"PARENT" would silently omit unpublished subjects, making
 * incompleteness undetectable.
 */
async function gatherSnapshot(
  studentId: string,
  schoolId: string,
  academicSessionId: string
): Promise<{ ok: true; data: SnapshotResult } | { ok: false; reason: string }> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true } });
  if (!school) return { ok: false, reason: "School not found." };

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { id: true } } },
  });
  if (!student) return { ok: false, reason: "Student not found." };

  const placement = await resolveCurrentPlacement(studentId, schoolId);
  if (!placement || placement.academicSessionId !== academicSessionId) {
    return { ok: false, reason: "No current grade placement found for this student at this school and session." };
  }

  if (placement.status === "ENROLLED") {
    return {
      ok: false,
      reason: "Record the student's academic progression decision (Promote/Repeat/Transfer/Leave) before issuing the Mark Sheet.",
    };
  }
  if (!GRADE_HISTORY_STATUSES.includes(placement.status as any)) {
    // Defensive — recordGradeDecision() already validates this at write
    // time, so this should be unreachable in practice.
    return { ok: false, reason: "The recorded progression decision is not a recognized status." };
  }

  let outcomeGradeDisplayName: string | null = null;
  if (placement.outcomeGradeId) {
    const outcomeGrade = await prisma.schoolGrade.findUnique({
      where: { id: placement.outcomeGradeId },
      select: { displayName: true },
    });
    outcomeGradeDisplayName = outcomeGrade?.displayName ?? null;
  }

  const { subjects, gpa } = await fetchAssessmentResults(studentId, schoolId, "STAFF");
  if (subjects.length === 0) {
    return { ok: false, reason: "No assessment results exist yet for this student this session." };
  }
  const unpublished = subjects.filter((s) => s.publicationStatus !== "PUBLISHED");
  if (unpublished.length > 0) {
    return {
      ok: false,
      reason: `${unpublished.length} subject(s) are not yet published: ${unpublished.map((s) => s.subjectName).join(", ")}.`,
    };
  }

  return {
    ok: true,
    data: {
      placement,
      school,
      student: { id: student.id, fullName: student.fullName, megaId: student.user?.id ?? null },
      outcomeGradeDisplayName,
      subjects,
      gpa,
    },
  };
}

/**
 * Read-only preview for the School Admin UI — "is this student ready
 * for Mark Sheet issuance," with enough detail to render a preview
 * before committing to Issue. Never writes anything.
 */
export async function checkMarkSheetEligibility(
  studentId: string,
  schoolId: string,
  academicSessionId: string
): Promise<MarkSheetEligibility> {
  const result = await gatherSnapshot(studentId, schoolId, academicSessionId);
  if (!result.ok) return { eligible: false, reason: result.reason };
  const { data } = result;
  return {
    eligible: true,
    schoolName: data.school.name,
    sessionName: data.placement.academicSession.name,
    gradeDisplayName: data.placement.schoolGrade.displayName,
    sectionName: data.placement.section?.name ?? null,
    outcomeStatus: data.placement.status,
    subjectCount: data.subjects.length,
    gpa: data.gpa,
  };
}

type WriteMarkSheetInput = {
  studentId: string;
  schoolId: string;
  academicSessionId: string;
  issuedByUserId: string;
  issuerName: string;
  correctionReason?: string;
};

export type MarkSheetWriteResult =
  | { ok: true; markSheet: { id: string; version: number } }
  | { ok: false; reason: string };

/**
 * The shared, transactional write core for both issueMarkSheet() and
 * correctMarkSheet() below — never called directly by a route. Freezes
 * gatherSnapshot()'s already-verified data into one new MarkSheet
 * version + its MarkSheetSubject rows, atomically. `expectExisting`
 * distinguishes a first issuance (must find no current ISSUED row) from
 * a correction (must find one to supersede) — this is what makes
 * issueMarkSheet()/correctMarkSheet() fail with a clear, specific
 * message instead of silently doing the wrong one of the two.
 */
async function writeMarkSheetVersion(
  input: WriteMarkSheetInput,
  expectExisting: boolean
): Promise<MarkSheetWriteResult> {
  const gathered = await gatherSnapshot(input.studentId, input.schoolId, input.academicSessionId);
  if (!gathered.ok) return { ok: false, reason: gathered.reason };
  const { data } = gathered;

  if (expectExisting && !input.correctionReason?.trim()) {
    return { ok: false, reason: "A correction reason is required." };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const currentIssued = await tx.markSheet.findFirst({
        where: { studentId: input.studentId, academicSessionId: input.academicSessionId, status: "ISSUED" },
      });

      if (expectExisting && !currentIssued) {
        throw new MarkSheetBusinessError("No issued Mark Sheet exists yet for this student and session to correct.");
      }
      if (!expectExisting && currentIssued) {
        throw new MarkSheetBusinessError("A Mark Sheet has already been issued for this student and session — use the correction action instead.");
      }

      const newVersion = currentIssued ? currentIssued.version + 1 : 1;

      const newMarkSheet = await tx.markSheet.create({
        data: {
          studentId: input.studentId,
          schoolId: input.schoolId,
          academicSessionId: input.academicSessionId,
          version: newVersion,
          status: "ISSUED",
          issuedByUserId: input.issuedByUserId,
          issuerNameSnapshot: input.issuerName,
          schoolNameSnapshot: data.school.name,
          academicSessionNameSnapshot: data.placement.academicSession.name,
          gradeDisplayNameSnapshot: data.placement.schoolGrade.displayName,
          sectionNameSnapshot: data.placement.section?.name ?? null,
          studentNameSnapshot: data.student.fullName,
          studentMegaIdSnapshot: data.student.megaId,
          outcomeStatus: data.placement.status,
          outcomeGradeDisplayNameSnapshot: data.outcomeGradeDisplayName,
          gpaSnapshot: data.gpa,
          correctionReason: expectExisting ? input.correctionReason!.trim() : null,
          subjects: {
            create: data.subjects.map((s, index) => ({
              gradeSubjectId: s.gradeSubjectId,
              subjectNameSnapshot: s.subjectName,
              order: index,
              marksObtained: s.subjectTotal.totalObtained,
              maximumMarks: s.subjectTotal.totalMax,
              percentage: s.subjectTotal.percentage,
              gradeLabel: s.grade?.label ?? null,
              gradePoint: s.grade?.gradePoint ?? null,
            })),
          },
        },
      });

      if (currentIssued) {
        // Optimistic lock: only succeeds if the row is still exactly
        // the ISSUED version we just read. If another correction beat
        // us to it, affected count is 0 and we abort the whole
        // transaction — the newMarkSheet insert above rolls back too,
        // so no orphaned/competing version is ever left behind.
        const supersedeResult = await tx.markSheet.updateMany({
          where: { id: currentIssued.id, status: "ISSUED" },
          data: { status: "SUPERSEDED", supersededByMarkSheetId: newMarkSheet.id },
        });
        if (supersedeResult.count !== 1) {
          throw new MarkSheetBusinessError("Another correction was already applied concurrently — please refresh and try again.");
        }
      }

      return newMarkSheet;
    });

    return { ok: true, markSheet: { id: created.id, version: created.version } };
  } catch (err) {
    if (err instanceof MarkSheetBusinessError) return { ok: false, reason: err.message };
    // A unique-constraint violation on (studentId, academicSessionId, version)
    // means a concurrent Issue/correction won the race for this exact
    // version number — the DB-level backstop behind the optimistic lock
    // above. Surface it the same way, not as a 500.
    if (err instanceof Error && /Unique constraint/i.test(err.message)) {
      return { ok: false, reason: "This Mark Sheet was already issued or corrected concurrently — please refresh and try again." };
    }
    throw err;
  }
}

class MarkSheetBusinessError extends Error {}

/**
 * Issues Version 1 of a student's annual Mark Sheet. School-Admin-only
 * — callers must have already run requireSchoolAdmin(schoolId). Fails
 * clearly (never throws for an expected business-rule gap) if a Mark
 * Sheet already exists, if the promotion decision hasn't been recorded
 * yet, or if required results aren't all published.
 */
export async function issueMarkSheet(input: Omit<WriteMarkSheetInput, "correctionReason">): Promise<MarkSheetWriteResult> {
  return writeMarkSheetVersion(input, false);
}

/**
 * Creates a corrected new version, superseding the current ISSUED
 * version. School-Admin-only. Requires a non-empty correctionReason.
 * The prior version is never edited — only marked SUPERSEDED and linked
 * forward.
 */
export async function correctMarkSheet(input: WriteMarkSheetInput & { correctionReason: string }): Promise<MarkSheetWriteResult> {
  return writeMarkSheetVersion(input, true);
}
