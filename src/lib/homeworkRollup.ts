import { prisma } from "@/lib/prisma";

export type HomeworkRollup = {
  assigned: number;
  unrecorded: number;
  completed: number;
  partial: number;
  notCompleted: number;
  excused: number;
  // Completed / (Applicable - Excused), per the approved denominator
  // rule — Excused rows are removed from BOTH sides, never counted
  // against a student. null when the denominator is 0 (every applicable
  // student is Excused, or there are zero applicable students) — never
  // a manufactured percentage in that case.
  completionPercentage: number | null;
};

/**
 * K5 — the one rollup primitive, a LIVE query over exactly the same
 * (HomeworkApplicability, HomeworkCompletion) join K2's own completion
 * route already reads — no persisted counter, no cache, matching every
 * other aggregate in this codebase (fetchAssessmentResults(),
 * buildReportCard(), computeUnweightedGPA() are all live-computed on
 * read). Works identically for a Regular or an Individual Homework's
 * own applicability set — the HARD "never blend Regular and Individual"
 * rule is enforced by ALWAYS calling this once per single Homework
 * (never merging applicability rows across several Homework items), and
 * by the caller never rendering a percentage for an Individual result
 * (see fetchClassTeacherHomeworkProgress() below and the completion
 * page's own UI) — this function itself has no opinion on Regular vs
 * Individual, since the correct separation is "one call per Homework,"
 * not something the aggregation math itself needs to know.
 *
 * Historical by construction: reads HomeworkApplicability's own,
 * immutable rows — never re-derives the roster from current
 * GradeHistory, so a transferred/left student's row is counted exactly
 * as it was at publish time, forever.
 */
export async function computeHomeworkRollup(homeworkId: string): Promise<HomeworkRollup> {
  const rows = await prisma.homeworkApplicability.findMany({
    where: { homeworkId },
    include: { completion: { select: { status: true } } },
  });

  let completed = 0,
    partial = 0,
    notCompleted = 0,
    excused = 0,
    unrecorded = 0;

  for (const row of rows) {
    switch (row.completion?.status) {
      case "COMPLETED":
        completed++;
        break;
      case "PARTIAL":
        partial++;
        break;
      case "NOT_COMPLETED":
        notCompleted++;
        break;
      case "EXCUSED":
        excused++;
        break;
      default:
        unrecorded++;
    }
  }

  const denominator = rows.length - excused;
  const completionPercentage = denominator > 0 ? (completed / denominator) * 100 : null;

  return { assigned: rows.length, unrecorded, completed, partial, notCompleted, excused, completionPercentage };
}

export type ClassProgressHomeworkRow = {
  homeworkId: string;
  title: string;
  subjectName: string;
  sectionName: string | null;
  dueDate: string;
  rollup: HomeworkRollup;
};

/**
 * K5 — Class Teacher / Grade Coordinator read-only progress view: every
 * PUBLISHED REGULAR Homework (targetStudentId: null — Individual
 * Homework never appears here, per the hard separation rule) relevant
 * to one ClassTeacherAssignment's own scope, each with its own rollup.
 *
 * viewerSectionId is the CALLER's OWN ClassTeacherAssignment.sectionId
 * — null (Grade Coordinator) sees every Regular Homework in the grade,
 * grade-wide and every section's; a real section id (Class Teacher)
 * sees only grade-wide Homework plus that ONE section's own — never a
 * different section's, matching the same "grade-wide OR that exact
 * section" idiom used throughout this codebase, just applied to which
 * Homework rows are visible rather than to an authorization check.
 *
 * Authorization itself (does the caller actually hold this
 * ClassTeacherAssignment) is the caller's responsibility — this
 * function does none of its own, matching every other fetch* function's
 * documented contract in this codebase.
 */
export async function fetchClassTeacherHomeworkProgress(
  schoolGradeId: string,
  academicSessionId: string,
  viewerSectionId: string | null
): Promise<ClassProgressHomeworkRow[]> {
  const homeworks = await prisma.homework.findMany({
    where: {
      schoolGradeId,
      academicSessionId,
      status: "PUBLISHED",
      targetStudentId: null,
      ...(viewerSectionId ? { OR: [{ sectionId: null }, { sectionId: viewerSectionId }] } : {}),
    },
    include: { subject: true, section: true },
    orderBy: { dueDate: "desc" },
  });

  return Promise.all(
    homeworks.map(async (hw) => ({
      homeworkId: hw.id,
      title: hw.title,
      subjectName: hw.subject.name,
      sectionName: hw.section?.name ?? null,
      dueDate: hw.dueDate.toISOString().slice(0, 10),
      rollup: await computeHomeworkRollup(hw.id),
    }))
  );
}

export type IndividualHomeworkProgressRow = {
  homeworkId: string;
  title: string;
  subjectName: string;
  targetStudentName: string;
  dueDate: string;
  // Deliberately no percentage field — a single-target assignment has
  // no meaningful "class completion rate." Status is either unrecorded
  // or one of the four completion values.
  status: "COMPLETED" | "PARTIAL" | "NOT_COMPLETED" | "EXCUSED" | null;
};

/**
 * K5 — the Individual Homework counterpart to
 * fetchClassTeacherHomeworkProgress(): a plain LIST, never a
 * percentage, per the hard "never represent Individual Homework as a
 * class completion percentage" rule. Same viewer-scope semantics
 * (viewerSectionId null = every Individual Homework in the grade;
 * a real section id = only Individual Homework whose target student's
 * CURRENT roster placement in this grade/session is that section —
 * resolved via the target's own current placement, matching the same
 * live-authorization-scope reasoning already used for Individual
 * Homework completion authorization, never a stored section on the
 * Homework row itself, which for Individual Homework is always null).
 */
export async function fetchIndividualHomeworkProgress(
  schoolGradeId: string,
  academicSessionId: string,
  viewerSectionId: string | null
): Promise<IndividualHomeworkProgressRow[]> {
  const homeworks = await prisma.homework.findMany({
    where: { schoolGradeId, academicSessionId, status: "PUBLISHED", targetStudentId: { not: null } },
    include: { subject: true, targetStudent: true, applicability: { include: { completion: true } } },
    orderBy: { dueDate: "desc" },
  });

  const rows: IndividualHomeworkProgressRow[] = [];
  for (const hw of homeworks) {
    if (viewerSectionId) {
      const placement = await prisma.gradeHistory.findFirst({
        where: {
          studentId: hw.targetStudentId!,
          academicSessionId,
          schoolGradeId,
          status: { in: ["ENROLLED", "COMPLETED", "REPEATED"] },
        },
      });
      if (!placement || placement.sectionId !== viewerSectionId) continue;
    }
    rows.push({
      homeworkId: hw.id,
      title: hw.title,
      subjectName: hw.subject.name,
      targetStudentName: hw.targetStudent?.fullName ?? "",
      dueDate: hw.dueDate.toISOString().slice(0, 10),
      status: (hw.applicability[0]?.completion?.status as IndividualHomeworkProgressRow["status"]) ?? null,
    });
  }
  return rows;
}
