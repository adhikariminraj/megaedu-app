import { prisma } from "@/lib/prisma";

/**
 * Co-Scholastic — a second, parallel, non-numeric evaluation axis
 * (Work Education, Art, Health & Physical Education, Discipline, etc.),
 * structurally independent of the scholastic assessment engine. See
 * docs/CO_SCHOLASTIC.md and the CoScholastic* model comments in
 * schema.prisma.
 *
 * Deliberately no calculation engine here — grades are ordinal labels,
 * never aggregated across periods (see CoScholasticResult's own model
 * comment for the real-world evidence behind that decision). This
 * module is pure fetch/entry, the co-scholastic equivalent of
 * assessmentResults.ts's read side, minus any arithmetic.
 *
 * No publication/visibility gate exists for co-scholastic in this
 * kilometer — a result is visible as soon as it's entered, the same
 * simplicity Attendance already has. This is a deliberate scope
 * decision (the approved architecture never specified a
 * CoScholasticResultPublication model), surfaced here rather than
 * silently assumed.
 */

export type CoScholasticAreaResult = {
  areaId: string;
  areaName: string;
  /** The annual/final grade — always independently entered, never derived. */
  annualGradeLabel: string | null;
  /** Present only for a grade+session configured with CoScholasticPeriods. */
  periodGrades: { periodId: string; periodName: string; gradeLabel: string | null }[];
};

/**
 * Every configured co-scholastic area's result for one student, at
 * their current grade+session. Returns [] if the grade has no areas
 * configured (or no CoScholasticGradeSetting yet) — never guessed.
 * Callers are responsible for only ever passing a studentId they've
 * already verified the caller is allowed to see — this function does
 * no authorization itself, same contract as fetchAssessmentResults().
 */
export async function fetchCoScholasticForStudent(
  studentId: string,
  schoolId: string,
  schoolGradeId: string,
  academicSessionId: string
): Promise<CoScholasticAreaResult[]> {
  const [areas, periods, results] = await Promise.all([
    prisma.coScholasticArea.findMany({
      where: { schoolId, isActive: true },
      orderBy: { order: "asc" },
    }),
    prisma.coScholasticPeriod.findMany({
      where: { schoolGradeId, academicSessionId },
      orderBy: { order: "asc" },
    }),
    prisma.coScholasticResult.findMany({
      where: { studentId, academicSessionId },
    }),
  ]);

  if (areas.length === 0) return [];

  const resultsByAreaId = new Map<string, typeof results>();
  for (const r of results) {
    resultsByAreaId.set(r.areaId, [...(resultsByAreaId.get(r.areaId) ?? []), r]);
  }

  return areas.map((area) => {
    const areaResults = resultsByAreaId.get(area.id) ?? [];
    const annual = areaResults.find((r) => r.coScholasticPeriodId === null);
    return {
      areaId: area.id,
      areaName: area.name,
      annualGradeLabel: annual?.gradeLabel ?? null,
      periodGrades: periods.map((p) => ({
        periodId: p.id,
        periodName: p.name,
        gradeLabel: areaResults.find((r) => r.coScholasticPeriodId === p.id)?.gradeLabel ?? null,
      })),
    };
  });
}

/**
 * The school's configured grading scale for one grade+session's
 * co-scholastic evaluation — resolved at (school, grade, session), per
 * the approved architecture (one scale governs every area for that
 * grade that session; real evidence showed different grades in the
 * same school using different scales, but never different areas within
 * one grade using different scales).
 */
export async function resolveCoScholasticGradingScale(schoolId: string, schoolGradeId: string, academicSessionId: string) {
  const setting = await prisma.coScholasticGradeSetting.findUnique({
    where: { schoolGradeId_academicSessionId: { schoolGradeId, academicSessionId } },
    include: { gradingScale: { include: { bands: { orderBy: { order: "asc" } } } } },
  });
  return setting?.gradingScale ?? null;
}

type UpsertCoScholasticResultInput = {
  studentId: string;
  areaId: string;
  academicSessionId: string;
  /** null = the annual/full-session entry; a real id = scoped to that period. */
  coScholasticPeriodId: string | null;
  gradeLabel: string;
  evaluatedByUserId: string;
};

/**
 * The only path that creates/updates a CoScholasticResult row. For the
 * annual case (coScholasticPeriodId: null), pre-checks explicitly
 * rather than relying on upsert()'s compound-unique lookup — the same
 * documented SQLite NULL≠NULL gap already worked around elsewhere in
 * this schema (AssessmentComponent, AssessmentFrameworkAssignment,
 * StudentEvaluation): SQLite does not treat two NULLs as conflicting
 * for a unique index, so upsert()'s ON CONFLICT path cannot be trusted
 * for that branch. The period-scoped case has no such gap (the
 * constraint's columns are all non-null), so a plain upsert() is safe.
 */
export async function upsertCoScholasticResult(input: UpsertCoScholasticResultInput) {
  const data = {
    gradeLabel: input.gradeLabel,
    evaluatedByUserId: input.evaluatedByUserId,
    evaluatedAt: new Date(),
  };

  if (input.coScholasticPeriodId === null) {
    const existing = await prisma.coScholasticResult.findFirst({
      where: { studentId: input.studentId, areaId: input.areaId, coScholasticPeriodId: null },
    });
    if (existing) {
      return prisma.coScholasticResult.update({ where: { id: existing.id }, data });
    }
    return prisma.coScholasticResult.create({
      data: {
        studentId: input.studentId,
        areaId: input.areaId,
        academicSessionId: input.academicSessionId,
        coScholasticPeriodId: null,
        ...data,
      },
    });
  }

  return prisma.coScholasticResult.upsert({
    where: {
      studentId_areaId_coScholasticPeriodId: {
        studentId: input.studentId,
        areaId: input.areaId,
        coScholasticPeriodId: input.coScholasticPeriodId,
      },
    },
    create: {
      studentId: input.studentId,
      areaId: input.areaId,
      academicSessionId: input.academicSessionId,
      coScholasticPeriodId: input.coScholasticPeriodId,
      ...data,
    },
    update: data,
  });
}
