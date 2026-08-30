import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveFrameworkAssignment } from "@/lib/assessmentFramework";
import { fetchAcademicProgress } from "@/lib/academicProgress";

export const RESULT_STATUSES = ["PENDING", "EVALUATED", "ABSENT"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const PUBLICATION_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

// ============================================================
// Pure calculation core — no Prisma reads/writes below this line
// until fetchAssessmentResults(). Every number a Report Card, a
// dashboard, or a publish check needs is computed here and ONLY here,
// so no caller ever reimplements this arithmetic.
// ============================================================

type ComponentLike = { id: string; periodId: string | null; name: string; maxMarks: number; entryMode: string };
type ResultLike = {
  componentId: string;
  status: string;
  marksObtained: number | null;
  gradeLabel: string | null;
  remarks: string | null;
};
type BandLike = {
  minPercent: number;
  maxPercent: number;
  label: string;
  gradePoint: number | null;
  isPassing: boolean | null;
  description: string | null;
};

export type ComponentContribution = {
  componentId: string;
  name: string;
  maxMarks: number;
  entryMode: string;
  status: string;
  /** Points this component contributes toward the group total. Null only when excluded (DESCRIPTIVE) or PENDING. */
  value: number | null;
  /** True for DESCRIPTIVE components — never part of any numeric total. */
  excluded: boolean;
  remarks: string | null;
};

/**
 * The single place a component's raw result becomes a number of
 * points, out of its own maxMarks. MARKS: the raw entry, directly.
 * GRADE: the matching GradingScaleBand's PERCENTAGE (not gradePoint —
 * see docs/ASSESSMENT_RESULTS.md for why using gradePoint as a ratio
 * would silently assume every scale is normalized to the same range),
 * applied to maxMarks. DESCRIPTIVE: always excluded, never a number.
 * ABSENT: zero, regardless of entryMode — the standard "an absence
 * scores zero" convention, matching UnitTestResult's own status
 * semantics. PENDING: null, not zero — a genuinely missing result must
 * never be silently counted as a zero.
 */
export function computeComponentContribution(
  component: ComponentLike,
  result: ResultLike | undefined,
  bands: BandLike[]
): ComponentContribution {
  const base = {
    componentId: component.id,
    name: component.name,
    maxMarks: component.maxMarks,
    entryMode: component.entryMode,
    remarks: result?.remarks ?? null,
  };

  if (component.entryMode === "DESCRIPTIVE") {
    return { ...base, status: result?.status ?? "PENDING", value: null, excluded: true };
  }

  const status = result?.status ?? "PENDING";
  if (status === "PENDING") {
    return { ...base, status, value: null, excluded: false };
  }
  if (status === "ABSENT") {
    return { ...base, status, value: 0, excluded: false };
  }

  // EVALUATED
  if (component.entryMode === "MARKS") {
    const value = typeof result?.marksObtained === "number" ? result.marksObtained : null;
    return { ...base, status, value, excluded: false };
  }

  // GRADE — find the band matching the recorded label, use its
  // percentage midpoint (never gradePoint) to derive the contribution.
  const band = bands.find((b) => b.label === result?.gradeLabel);
  if (!band) {
    // Data-quality gap (a label with no matching band, e.g. after the
    // scale changed) — never guess a value. Surfaced as null, same
    // "never guess when confidence is low" discipline as
    // matchLegacyGradeText().
    return { ...base, status, value: null, excluded: false };
  }
  const midpointPercent = (band.minPercent + band.maxPercent) / 2;
  return { ...base, status, value: (midpointPercent / 100) * component.maxMarks, excluded: false };
}

export type GroupResult = {
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  isComplete: boolean;
  hasAbsent: boolean;
  components: ComponentContribution[];
};

/**
 * Sums a set of component contributions into one group total — used
 * identically for a period's components and, when a framework has no
 * periods, for the framework's components directly (the same function,
 * never two code paths). DESCRIPTIVE components are excluded from both
 * numerator and denominator entirely. isComplete is false if any
 * non-DESCRIPTIVE component is still PENDING — percentage is null in
 * that case, never a partial number.
 */
export function aggregateGroup(components: ComponentLike[], results: ResultLike[], bands: BandLike[]): GroupResult {
  const resultByComponentId = new Map(results.map((r) => [r.componentId, r]));
  const contributions = components.map((c) => computeComponentContribution(c, resultByComponentId.get(c.id), bands));

  const numeric = contributions.filter((c) => !c.excluded);
  const isComplete = numeric.every((c) => c.status !== "PENDING");
  const hasAbsent = numeric.some((c) => c.status === "ABSENT");
  const totalMax = numeric.reduce((sum, c) => sum + c.maxMarks, 0);
  const totalObtained = isComplete ? numeric.reduce((sum, c) => sum + (c.value ?? 0), 0) : 0;

  return {
    totalObtained,
    totalMax,
    percentage: isComplete && totalMax > 0 ? (totalObtained / totalMax) * 100 : null,
    isComplete,
    hasAbsent,
    components: contributions,
  };
}

export type GradeLookup = { label: string; gradePoint: number | null; isPassing: boolean | null; description: string | null };

/**
 * Finds the GradingScaleBand a percentage falls into. Top band is
 * lower-inclusive/upper-exclusive (minPercent <= p < maxPercent), so a
 * shared boundary (e.g. one band's maxPercent 80 touching the next
 * band's minPercent 80) is never ambiguous — the band that STARTS at
 * 80 wins, matching standard grading convention ("80-89" means 80
 * belongs to the higher band, not the lower one). The single exception
 * is a percentage of exactly 100, which matches whichever band's own
 * maxPercent is 100 (there is no "upper" band to hand it to). Returns
 * null when no scale is in use (marks-only framework) or the
 * percentage itself is null (incomplete) — never a guessed match.
 */
export function lookupGrade(percentage: number | null, bands: BandLike[]): GradeLookup | null {
  if (percentage === null || bands.length === 0) return null;
  const band = bands.find(
    (b) => percentage >= b.minPercent && (percentage < b.maxPercent || (percentage === 100 && b.maxPercent === 100))
  );
  if (!band) return null;
  return { label: band.label, gradePoint: band.gradePoint, isPassing: band.isPassing, description: band.description };
}

export type SubjectResult = {
  gradeSubjectId: string;
  subjectName: string;
  frameworkId: string;
  frameworkName: string;
  periods: { periodId: string; name: string; result: GroupResult; grade: GradeLookup | null }[];
  subjectTotal: GroupResult;
  grade: GradeLookup | null;
  publicationStatus: PublicationStatus;
};

/**
 * Aggregates one subject's full result: components -> period results
 * (if the framework has periods) -> subject total, OR components ->
 * subject total directly (if it doesn't) — the same aggregateGroup()
 * call at every level, never two different implementations. The
 * subject total is the sum of every period's (totalObtained, totalMax)
 * when periods exist, or the flat component aggregate otherwise.
 */
export function computeSubjectResultFromParts(parts: {
  gradeSubjectId: string;
  subjectName: string;
  frameworkId: string;
  frameworkName: string;
  periods: { id: string; name: string }[];
  components: ComponentLike[];
  results: ResultLike[];
  bands: BandLike[];
  publicationStatus: PublicationStatus;
}): SubjectResult {
  const { periods, components, results, bands } = parts;

  if (periods.length === 0) {
    const subjectTotal = aggregateGroup(components, results, bands);
    return {
      gradeSubjectId: parts.gradeSubjectId,
      subjectName: parts.subjectName,
      frameworkId: parts.frameworkId,
      frameworkName: parts.frameworkName,
      periods: [],
      subjectTotal,
      grade: lookupGrade(subjectTotal.percentage, bands),
      publicationStatus: parts.publicationStatus,
    };
  }

  const periodResults = periods.map((p) => {
    const periodComponents = components.filter((c) => c.periodId === p.id);
    const result = aggregateGroup(periodComponents, results, bands);
    return { periodId: p.id, name: p.name, result, grade: lookupGrade(result.percentage, bands) };
  });
  // Components with no period (periodId: null) under a framework that
  // otherwise has periods — still summed into the subject total
  // directly, not silently dropped.
  const looseComponents = components.filter((c) => c.periodId === null);

  const allComplete = periodResults.every((p) => p.result.isComplete) && (looseComponents.length === 0 || aggregateGroup(looseComponents, results, bands).isComplete);
  const looseTotal = looseComponents.length > 0 ? aggregateGroup(looseComponents, results, bands) : null;
  const totalObtained = periodResults.reduce((sum, p) => sum + p.result.totalObtained, 0) + (looseTotal?.totalObtained ?? 0);
  const totalMax = periodResults.reduce((sum, p) => sum + p.result.totalMax, 0) + (looseTotal?.totalMax ?? 0);
  const hasAbsent = periodResults.some((p) => p.result.hasAbsent) || (looseTotal?.hasAbsent ?? false);

  const subjectTotal: GroupResult = {
    totalObtained,
    totalMax,
    percentage: allComplete && totalMax > 0 ? (totalObtained / totalMax) * 100 : null,
    isComplete: allComplete,
    hasAbsent,
    components: [...periodResults.flatMap((p) => p.result.components), ...(looseTotal?.components ?? [])],
  };

  return {
    gradeSubjectId: parts.gradeSubjectId,
    subjectName: parts.subjectName,
    frameworkId: parts.frameworkId,
    frameworkName: parts.frameworkName,
    periods: periodResults,
    subjectTotal,
    grade: lookupGrade(subjectTotal.percentage, bands),
    publicationStatus: parts.publicationStatus,
  };
}

/**
 * Cross-subject GPA — explicitly and only an UNWEIGHTED average of
 * whichever subjects have a resolvable gradePoint (a marks-only or
 * Pass/Fail subject simply doesn't contribute one). No subject-credit
 * or weighting concept exists in this schema; do not add one here —
 * see docs/ASSESSMENT_RESULTS.md. Returns null if no subject has a
 * gradePoint at all (e.g. every subject uses a marks-only scale).
 */
export function computeUnweightedGPA(subjectResults: SubjectResult[]): number | null {
  const points = subjectResults.map((s) => s.grade?.gradePoint).filter((p): p is number => typeof p === "number");
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}

// ============================================================
// Read side — resolves live data, then hands it to the pure functions
// above. Follows fetchAcademicProgress()'s exact audience convention.
// ============================================================

const gradingScaleInclude = { bands: { orderBy: { order: "asc" as const } } };
const frameworkInclude = {
  periods: { orderBy: { order: "asc" as const } },
  components: { orderBy: { order: "asc" as const } },
  gradingScale: { include: gradingScaleInclude },
};

/**
 * Every published (or, for STAFF, every) subject result for one
 * student in their current active-session grade. "STUDENT" and
 * "PARENT" both filter to AssessmentResultPublication.status ===
 * "PUBLISHED" only; "STAFF" applies no filter — the identical
 * three-way convention fetchAcademicProgress() already established.
 * Callers are responsible for only ever passing a studentId they've
 * already verified the caller is allowed to see — this function does
 * no authorization itself, same contract as fetchAcademicProgress().
 */
export async function fetchAssessmentResults(
  studentId: string,
  audience: "STUDENT" | "PARENT" | "STAFF"
): Promise<{ subjects: SubjectResult[]; gpa: number | null }> {
  const placement = await prisma.gradeHistory.findFirst({
    where: { studentId, academicSession: { status: "ACTIVE" } },
    include: { academicSession: true, schoolGrade: true },
  });
  if (!placement) return { subjects: [], gpa: null };

  const gradeSubjects = await prisma.gradeSubject.findMany({
    where: { schoolGradeId: placement.schoolGradeId, academicSessionId: placement.academicSessionId },
    include: { subject: true },
  });

  const subjects: SubjectResult[] = [];
  for (const gs of gradeSubjects) {
    const assignment = await resolveFrameworkAssignment({
      academicSessionId: placement.academicSessionId,
      schoolGradeId: placement.schoolGradeId,
      gradeSubjectId: gs.id,
    });
    if (!assignment) continue; // no framework configured for this subject yet

    const publication = await prisma.assessmentResultPublication.findUnique({
      where: { gradeSubjectId_studentId: { gradeSubjectId: gs.id, studentId } },
    });
    const publicationStatus: PublicationStatus = (publication?.status as PublicationStatus) ?? "DRAFT";
    if (audience !== "STAFF" && publicationStatus !== "PUBLISHED") continue;

    const framework = await prisma.assessmentFramework.findUniqueOrThrow({
      where: { id: assignment.frameworkId },
      include: frameworkInclude,
    });
    const results = await prisma.assessmentComponentResult.findMany({
      where: { studentId, componentId: { in: framework.components.map((c) => c.id) } },
    });

    subjects.push(
      computeSubjectResultFromParts({
        gradeSubjectId: gs.id,
        subjectName: gs.subject.name,
        frameworkId: framework.id,
        frameworkName: framework.name,
        periods: framework.periods,
        components: framework.components,
        results,
        bands: framework.gradingScale?.bands ?? [],
        publicationStatus,
      })
    );
  }

  return { subjects, gpa: computeUnweightedGPA(subjects) };
}

export type ReportCard = {
  student: { id: string; name: string; email: string };
  school: { name: string } | null;
  academicSession: { name: string } | null;
  grade: { displayName: string; sectionName: string | null } | null;
  subjects: SubjectResult[];
  gpa: number | null;
  attendance: Awaited<ReturnType<typeof fetchAcademicProgress>>["attendance"];
  evaluations: Awaited<ReturnType<typeof fetchAcademicProgress>>["evaluations"];
};

/**
 * Assembles a live Report Card view — NOT a persisted snapshot, unlike
 * Certificate. Report cards must reflect corrections made after
 * publication (see correctComponentResult()), so freezing one into a
 * stored row at some past moment would contradict that design.
 * Reuses fetchAcademicProgress() for attendance/evaluations rather
 * than re-querying them — the identical audience-filtered data a
 * Student/Parent/Staff already sees elsewhere in the app.
 */
export async function buildReportCard(
  studentId: string,
  audience: "STUDENT" | "PARENT" | "STAFF"
): Promise<ReportCard | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, school: true },
  });
  if (!student) return null;

  const placement = await prisma.gradeHistory.findFirst({
    where: { studentId, academicSession: { status: "ACTIVE" } },
    include: { academicSession: true, schoolGrade: true, section: true },
  });

  const [progress, assessment] = await Promise.all([
    fetchAcademicProgress(studentId, audience),
    fetchAssessmentResults(studentId, audience),
  ]);

  return {
    student: { id: student.id, name: student.user.name, email: student.user.email },
    school: student.school ? { name: student.school.name } : null,
    academicSession: placement ? { name: placement.academicSession.name } : null,
    grade: placement ? { displayName: placement.schoolGrade.displayName, sectionName: placement.section?.name ?? null } : null,
    subjects: assessment.subjects,
    gpa: assessment.gpa,
    attendance: progress.attendance,
    evaluations: progress.evaluations,
  };
}

/** Flattens SubjectResult[] into the row shape AcademicProgressPanel/report-card UIs render directly. */
export function toSubjectResultRows(subjects: SubjectResult[]) {
  return subjects.map((s) => ({
    gradeSubjectId: s.gradeSubjectId,
    subjectName: s.subjectName,
    totalObtained: s.subjectTotal.totalObtained,
    totalMax: s.subjectTotal.totalMax,
    percentage: s.subjectTotal.percentage,
    gradeLabel: s.grade?.label ?? null,
    gradePoint: s.grade?.gradePoint ?? null,
    isComplete: s.subjectTotal.isComplete,
  }));
}

// ============================================================
// Write side — the sole audited correction path for a result already
// EVALUATED/ABSENT once its subject is published. Freely editable
// (plain update, no audit) while the subject's publication is still
// DRAFT — the same "creation/drafting isn't a decision" reasoning used
// throughout this schema.
// ============================================================

type CorrectComponentResultInput = {
  resultId: string;
  newStatus: ResultStatus;
  newMarksObtained?: number | null;
  newGradeLabel?: string | null;
  newRemarks?: string | null;
  changedByUserId: string;
};

/**
 * The only code path allowed to change an existing
 * AssessmentComponentResult's status/marksObtained/gradeLabel/remarks.
 * ABSENT always clears marksObtained/gradeLabel/remarks regardless of
 * what's passed, matching UnitTestResult's identical rule. Once the
 * result's subject (gradeSubjectId + studentId) is PUBLISHED, every
 * edit pairs the update with an AssessmentComponentResultAudit row in
 * the same transaction — mirroring updateEvaluationRemarks() exactly.
 * The publication itself is NOT reverted to DRAFT by a correction —
 * an explicit, approved design decision (see docs/ASSESSMENT_RESULTS.md).
 */
export async function correctComponentResult(input: CorrectComponentResultInput, tx?: Prisma.TransactionClient) {
  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.assessmentComponentResult.findUniqueOrThrow({
      where: { id: input.resultId },
    });

    const newMarksObtained = input.newStatus === "ABSENT" ? null : input.newMarksObtained ?? null;
    const newGradeLabel = input.newStatus === "ABSENT" ? null : input.newGradeLabel ?? null;
    const newRemarks = input.newStatus === "ABSENT" ? null : input.newRemarks ?? current.remarks;

    const updated = await client.assessmentComponentResult.update({
      where: { id: input.resultId },
      data: {
        status: input.newStatus,
        marksObtained: newMarksObtained,
        gradeLabel: newGradeLabel,
        remarks: newRemarks,
        evaluatedByUserId: input.changedByUserId,
        evaluatedAt: new Date(),
      },
    });

    const publication = await client.assessmentResultPublication.findUnique({
      where: { gradeSubjectId_studentId: { gradeSubjectId: current.gradeSubjectId, studentId: current.studentId } },
    });
    let audit = null;
    if (publication?.status === "PUBLISHED") {
      audit = await client.assessmentComponentResultAudit.create({
        data: {
          resultId: input.resultId,
          changedByUserId: input.changedByUserId,
          previousStatus: current.status,
          newStatus: input.newStatus,
          previousMarksObtained: current.marksObtained,
          newMarksObtained,
          previousGradeLabel: current.gradeLabel,
          newGradeLabel,
          previousRemarks: current.remarks,
          newRemarks,
        },
      });
    }

    return { result: updated, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}
