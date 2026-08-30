import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const ENTRY_MODES = ["MARKS", "GRADE", "DESCRIPTIVE"] as const;
export type EntryMode = (typeof ENTRY_MODES)[number];

/**
 * Explicit pre-check for the grade-default AssessmentFrameworkAssignment
 * NULL≠NULL uniqueness gap: `@@unique([academicSessionId, schoolGradeId,
 * gradeSubjectId])` reliably blocks a duplicate subject-specific
 * override, but not a second grade-default (gradeSubjectId: null)
 * assignment for the same grade/session — SQL unique indexes treat
 * NULL as distinct from NULL, the same recurring gap already fixed for
 * TeacherAcademicAssignment/ClassTeacherAssignment/StudentEvaluation.
 * A plain `findFirst` with `gradeSubjectId: null` in the WHERE clause
 * (unlike a unique index) correctly matches existing null rows, so this
 * check works for both the null and non-null case identically.
 */
export async function assignmentCollisionExists(
  scope: { academicSessionId: string; schoolGradeId: string; gradeSubjectId: string | null },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const existing = await client.assessmentFrameworkAssignment.findFirst({
    where: {
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      gradeSubjectId: scope.gradeSubjectId,
    },
  });
  return !!existing;
}

/**
 * Explicit pre-check for AssessmentComponent's identical NULL≠NULL gap:
 * `@@unique([frameworkId, periodId, name])` does not by itself catch a
 * second identically-named component with periodId: null (framework-
 * level, no period) under the same framework. Same findFirst-based
 * technique as assignmentCollisionExists() above.
 */
export async function componentCollisionExists(
  scope: { frameworkId: string; periodId: string | null; name: string },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const existing = await client.assessmentComponent.findFirst({
    where: { frameworkId: scope.frameworkId, periodId: scope.periodId, name: scope.name },
  });
  return !!existing;
}

/**
 * Resolves which AssessmentFramework applies to a subject at a grade,
 * this session — the core Phase 3D-1 rule: a subject-specific
 * assignment (gradeSubjectId set) takes priority; otherwise fall back
 * to the grade-default assignment (gradeSubjectId: null). Returns null
 * if neither exists — a grade/subject with no framework configured yet
 * is a valid, ungraded state in this phase, not an error.
 *
 * gradeSubjectId is optional: omit it (or pass null) to resolve only
 * the grade-default, skipping the override lookup entirely — used when
 * the caller only cares about "what does this grade fall back to."
 */
export async function resolveFrameworkAssignment(scope: {
  academicSessionId: string;
  schoolGradeId: string;
  gradeSubjectId?: string | null;
}) {
  if (scope.gradeSubjectId) {
    const override = await prisma.assessmentFrameworkAssignment.findFirst({
      where: {
        academicSessionId: scope.academicSessionId,
        schoolGradeId: scope.schoolGradeId,
        gradeSubjectId: scope.gradeSubjectId,
      },
      include: { framework: { include: { gradingScale: true } } },
    });
    if (override) return override;
  }

  return prisma.assessmentFrameworkAssignment.findFirst({
    where: {
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      gradeSubjectId: null,
    },
    include: { framework: { include: { gradingScale: true } } },
  });
}
