// MEGA.EDU — Demo Data Verification
//
// Re-runnable sanity check for the demo environment created by
// `npm run db:seed` + `npm run db:seed:demo`. Exercises the same production
// calculation engine the real UI uses (fetchAssessmentResults(),
// computeUnweightedAveragePercentage(), CURRENT_ROSTER_STATUSES) rather than
// re-deriving expected values by hand, and checks for the specific failure
// modes that matter for a demo environment: multi-school data isolation,
// correct roster/section counts, genuine (not hard-coded) Repeated/Regular/
// newly-enrolled derivation, realistic (non-uniform) marks, draft-vs-
// published behavior, and referential integrity (no orphaned or duplicate
// rows). Exits non-zero if any check fails.
//
// Usage: npm run db:verify:demo

import { PrismaClient } from "@prisma/client";
import { CURRENT_ROSTER_STATUSES } from "../src/lib/gradeHistory";
import { fetchAssessmentResults, computeUnweightedAveragePercentage } from "../src/lib/assessmentResults";

const prisma = new PrismaClient();

async function main() {
  let failures = 0;
  function check(label: string, cond: boolean) {
    console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
    if (!cond) failures++;
  }

  // --- Multi-school isolation --------------------------------------------
  const sunrise = await prisma.school.findUniqueOrThrow({ where: { slug: "sunrise-academy" } });
  const himalayan = await prisma.school.findUniqueOrThrow({ where: { slug: "himalayan-secondary-school" } });
  check("Two schools exist", true);

  const sunriseStudentIds = new Set((await prisma.student.findMany({ where: { schoolId: sunrise.id }, select: { id: true } })).map((s) => s.id));
  const himalayanStudentIds = new Set((await prisma.student.findMany({ where: { schoolId: himalayan.id }, select: { id: true } })).map((s) => s.id));
  const overlap = [...sunriseStudentIds].filter((id) => himalayanStudentIds.has(id));
  check("No student belongs to both schools", overlap.length === 0);

  const himParent = await prisma.parent.findFirst({ where: { user: { email: { contains: "@megaedu.local" } }, children: { some: { student: { schoolId: himalayan.id } } } } });
  if (himParent) {
    const linkedToSunrise = await prisma.parentStudent.findFirst({ where: { parentId: himParent.id, student: { schoolId: sunrise.id } } });
    check("Himalayan parent has zero visibility into any Sunrise student", !linkedToSunrise);
  }

  // --- Class 9 roster (CURRENT_ROSTER_STATUSES) ---------------------------
  const class9 = await prisma.schoolGrade.findFirstOrThrow({ where: { schoolId: sunrise.id, displayName: "Class 9" } });
  const activeSession = await prisma.academicSession.findFirstOrThrow({ where: { schoolId: sunrise.id, status: "ACTIVE" } });
  const roster = await prisma.gradeHistory.findMany({
    where: { schoolGradeId: class9.id, academicSessionId: activeSession.id, status: { in: CURRENT_ROSTER_STATUSES as any } },
    include: { student: { include: { user: true } }, section: true },
  });
  check("Class 9 current roster has 34 students", roster.length === 34);
  const bySection: Record<string, number> = {};
  for (const r of roster) {
    const key = r.section?.name ?? "Unassigned";
    bySection[key] = (bySection[key] ?? 0) + 1;
  }
  console.log("  Section breakdown:", JSON.stringify(bySection));
  check("Sections A-D each have 8 students", ["A", "B", "C", "D"].every((s) => bySection[s] === 8));
  check("2 students are Unassigned", bySection["Unassigned"] === 2);

  // --- Repeated / Regular / Newly-enrolled badge logic (mirrors the app's own derivation) ---
  const priorSession = await prisma.academicSession.findFirstOrThrow({ where: { schoolId: sunrise.id, name: "2025-2026" } });
  let repeatedCount = 0, regularWithHistoryCount = 0, newlyEnrolledCount = 0;
  for (const r of roster) {
    const prior = await prisma.gradeHistory.findUnique({ where: { studentId_academicSessionId: { studentId: r.studentId, academicSessionId: priorSession.id } } });
    if (prior && prior.status === "REPEATED" && prior.outcomeGradeId === class9.id) repeatedCount++;
    else if (prior) regularWithHistoryCount++;
    else newlyEnrolledCount++;
  }
  console.log(`  Repeated: ${repeatedCount}, Regular (promoted): ${regularWithHistoryCount}, Newly enrolled (no prior row): ${newlyEnrolledCount}`);
  check("Exactly 1 student derives as Repeated", repeatedCount === 1);
  check("Some students derive as Regular (promoted)", regularWithHistoryCount > 0);
  check("Some students derive as genuinely newly enrolled", newlyEnrolledCount > 0);

  // --- Assessment results + ranking, via the REAL calculation engine ------
  const scored: { name: string; score: number }[] = [];
  const rawPercentages: number[] = [];
  for (const r of roster) {
    const { subjects, gpa } = await fetchAssessmentResults(r.studentId, "STUDENT");
    if (subjects.length === 0) continue;
    const score = typeof gpa === "number" ? gpa : computeUnweightedAveragePercentage(subjects);
    if (typeof score === "number") scored.push({ name: r.student.user.name, score });
    for (const subj of subjects) if (typeof subj.subjectTotal.percentage === "number") rawPercentages.push(subj.subjectTotal.percentage);
  }
  check("All 34 students have at least one published subject", scored.length === 34);
  scored.sort((a, b) => b.score - a.score);
  console.log("  Top 5 (via real calculation engine):", scored.slice(0, 5).map((s) => `${s.name} (${s.score.toFixed(2)})`).join(", "));
  // NOTE: GPA is intentionally coarse (only 6 possible values, since it's an
  // average of discrete grade-point bands) -- low GPA cardinality is
  // expected, not a sign of uniform data. Check the underlying raw subject
  // percentages instead, which is what's actually meant to vary per student.
  const uniquePercentages = new Set(rawPercentages.map((p) => p.toFixed(1)));
  console.log(`  ${rawPercentages.length} raw subject-percentage values, ${uniquePercentages.size} distinct`);
  check("Raw subject percentages are varied, not uniform (>20 distinct values)", uniquePercentages.size > 20);
  const sortedPct = [...rawPercentages].sort((a, b) => b - a);
  check("Percentage spread is realistic (top - bottom > 15 points)", sortedPct[0] - sortedPct[sortedPct.length - 1] > 15);

  // --- Published vs unpublished (IT) ---------------------------------------
  const itSubject = await prisma.gradeSubject.findFirstOrThrow({ where: { schoolGradeId: class9.id, subject: { name: "IT" } } });
  const itPublications = await prisma.assessmentResultPublication.count({ where: { gradeSubjectId: itSubject.id } });
  const itResults = await prisma.assessmentComponentResult.count({ where: { gradeSubjectId: itSubject.id } });
  check("IT has entered results but zero publications (draft state)", itResults > 0 && itPublications === 0);

  // --- Data integrity: no orphaned FK references --------------------------
  const allResults = await prisma.assessmentComponentResult.findMany({ select: { studentId: true, componentId: true, assignmentId: true, gradeSubjectId: true } });
  const studentIds = new Set((await prisma.student.findMany({ select: { id: true } })).map((s) => s.id));
  const componentIds = new Set((await prisma.assessmentComponent.findMany({ select: { id: true } })).map((c) => c.id));
  const orphanedResults = allResults.filter((r) => !studentIds.has(r.studentId) || !componentIds.has(r.componentId));
  check("Zero orphaned AssessmentComponentResult rows", orphanedResults.length === 0);

  const allGradeHistory = await prisma.gradeHistory.findMany({ select: { studentId: true, schoolGradeId: true, sectionId: true } });
  const gradeIds = new Set((await prisma.schoolGrade.findMany({ select: { id: true } })).map((g) => g.id));
  const sectionIds = new Set((await prisma.section.findMany({ select: { id: true } })).map((s) => s.id));
  const orphanedGH = allGradeHistory.filter((g) => !studentIds.has(g.studentId) || !gradeIds.has(g.schoolGradeId) || (g.sectionId && !sectionIds.has(g.sectionId)));
  check("Zero orphaned GradeHistory rows", orphanedGH.length === 0);

  // --- Duplicate check: no two GradeHistory rows for the same student+session ---
  const dupCheck = await prisma.$queryRawUnsafe<{ studentId: string; academicSessionId: string; c: number }[]>(
    `SELECT studentId, academicSessionId, COUNT(*) as c FROM GradeHistory GROUP BY studentId, academicSessionId HAVING c > 1`
  );
  check("No duplicate GradeHistory rows (studentId+session)", dupCheck.length === 0);

  // --- Teacher assignment overlap rule respected ---------------------------
  const taaRows = await prisma.teacherAcademicAssignment.findMany({ where: { schoolGradeId: class9.id }, select: { teacherId: true, subjectId: true, sectionId: true } });
  const byTeacherSubject: Record<string, Set<string | null>> = {};
  for (const t of taaRows) {
    const key = `${t.teacherId}|${t.subjectId}`;
    (byTeacherSubject[key] ??= new Set()).add(t.sectionId);
  }
  let overlapViolation = false;
  for (const key of Object.keys(byTeacherSubject)) {
    const sections = byTeacherSubject[key];
    if (sections.has(null) && sections.size > 1) overlapViolation = true;
  }
  check("No teacher holds both grade-wide AND section-specific for the same subject", !overlapViolation);

  // --- Certificates issued correctly ---------------------------------------
  const certCount = await prisma.certificate.count();
  check("At least 2 certificates exist (original CBE + new Hand Writing)", certCount >= 2);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
