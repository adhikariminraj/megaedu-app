import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Subject offerings (GradeSubject) — finding F8. Only an EMPTY offering may
 * be removed: every foreign key to GradeSubject is RESTRICT, so the database
 * refuses a removal that would delete or reclassify academic data, and the
 * removal route checks first so the admin gets a clear 409 listing what
 * depends on it.
 */

const DEPENDENTS = [
  { singular: "teacher assignment", plural: "teacher assignments", count: (where: { gradeSubjectId: string }) => prisma.teacherAcademicAssignment.count({ where }) },
  { singular: "teaching plan", plural: "teaching plans", count: (where: { gradeSubjectId: string }) => prisma.teachingPlan.count({ where }) },
  { singular: "unit", plural: "units", count: (where: { gradeSubjectId: string }) => prisma.teachingUnit.count({ where }) },
  { singular: "homework", plural: "homework", count: (where: { gradeSubjectId: string }) => prisma.homework.count({ where }) },
  { singular: "subject evaluation", plural: "subject evaluations", count: (where: { gradeSubjectId: string }) => prisma.studentEvaluation.count({ where }) },
  { singular: "parent-teacher meeting", plural: "parent-teacher meetings", count: (where: { gradeSubjectId: string }) => prisma.parentTeacherMeeting.count({ where }) },
  { singular: "framework override", plural: "framework overrides", count: (where: { gradeSubjectId: string }) => prisma.assessmentFrameworkAssignment.count({ where }) },
  { singular: "entered result", plural: "entered results", count: (where: { gradeSubjectId: string }) => prisma.assessmentComponentResult.count({ where }) },
  { singular: "result publication", plural: "result publications", count: (where: { gradeSubjectId: string }) => prisma.assessmentResultPublication.count({ where }) },
];

/** What still depends on an offering, as "3 homework, 1 unit" — empty string if nothing does. */
export async function describeOfferingDependents(gradeSubjectId: string): Promise<string> {
  const counts = await Promise.all(DEPENDENTS.map((d) => d.count({ gradeSubjectId })));
  return DEPENDENTS.map((d, i) => (counts[i] === 0 ? null : `${counts[i]} ${counts[i] === 1 ? d.singular : d.plural}`))
    .filter(Boolean)
    .join(", ");
}

/**
 * True when a write failed because the offering it references was removed
 * by a simultaneous request (the gradeSubjectId foreign key, Prisma P2003).
 */
export function isOfferingRemovedError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2003" &&
    String(err.meta?.field_name ?? "").includes("gradeSubjectId")
  );
}

export function offeringRemovedResponse() {
  return NextResponse.json(
    { error: "This subject is no longer offered at this grade this session — please refresh." },
    { status: 409 }
  );
}
