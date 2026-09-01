import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAssessmentResults, computeUnweightedAveragePercentage } from "@/lib/assessmentResults";
import { CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";
import PromotionRoster from "./PromotionRoster";

export const dynamic = "force-dynamic";

export default async function GradeRosterPage({
  params,
  searchParams,
}: {
  params: { schoolGradeId: string };
  searchParams: { session?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({
    where: { userId },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const schoolGrade = await prisma.schoolGrade.findUnique({
    where: { id: params.schoolGradeId },
    include: { gradeReference: true },
  });
  if (!schoolGrade || schoolGrade.schoolId !== schoolId) notFound();

  // Normally the current ACTIVE session — but the Pending/Unresolved
  // queue links here with ?session=<closed session id> so a School
  // Admin can go back and record the missing decision on an older,
  // now-closed session's roster. recordGradeDecision() itself doesn't
  // care about session status, so this works unchanged either way.
  const targetSession = searchParams.session
    ? await prisma.academicSession.findUnique({ where: { id: searchParams.session } })
    : await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

  if (!targetSession || targetSession.schoolId !== schoolId) redirect("/dashboard/grades");

  const [roster, allSchoolGrades, gradeSections, teacherAssignments, frameworkAssignmentCount] = await Promise.all([
    // The authoritative "who is currently in this grade this session"
    // roster. Every arrival path lands here: a fresh placement (Initial
    // Setup / Add Student / grade-placements all create ENROLLED rows
    // directly), a promoted student (carryForwardEligibleStudents()
    // creates a new ENROLLED row at their outcome grade next session),
    // and a repeated student (the identical carry-forward mechanism,
    // just with outcomeGradeId equal to the SAME grade). No separate
    // roster concept exists or is needed — see gradeRollover.ts.
    //
    // Deliberately NOT filtered to status: "ENROLLED" alone — a student
    // whose decision for NEXT session has already been recorded
    // (COMPLETED/REPEATED) is still physically in this grade for the
    // rest of THIS session; the decision only governs where they go
    // next. Excluding them here would make the "who's currently here"
    // roster silently empty out mid-session as decisions get recorded
    // early, well before the year actually ends — confirmed live: a
    // real row in this state existed in the seed data and was
    // incorrectly invisible under the old ENROLLED-only filter. Only
    // TRANSFERRED/LEFT are excluded — those students have genuinely left
    // the grade. The Promotion action panel below stays scoped to
    // ENROLLED-only selection (recordGradeDecision()/its route
    // independently re-validate this server-side regardless, so
    // broadening this display query changes nothing about who a new
    // decision can actually be applied to).
    prisma.gradeHistory.findMany({
      where: {
        schoolGradeId: params.schoolGradeId,
        academicSessionId: targetSession.id,
        status: { in: CURRENT_ROSTER_STATUSES },
      },
      include: { student: { include: { user: true } }, section: true },
      orderBy: { student: { user: { name: "asc" } } },
    }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    }),
    prisma.section.findMany({
      where: { schoolGradeId: params.schoolGradeId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.teacherAcademicAssignment.findMany({
      where: { schoolGradeId: params.schoolGradeId, academicSessionId: targetSession.id },
      include: { teacher: { include: { user: true } }, subject: true, section: true },
      orderBy: [{ teacher: { user: { name: "asc" } } }, { subject: { name: "asc" } }],
    }),
    prisma.assessmentFrameworkAssignment.count({
      where: { schoolGradeId: params.schoolGradeId, academicSessionId: targetSession.id },
    }),
  ]);

  // "Repeated" is only ever asserted from the student's own prior-session
  // GradeHistory decision — the same status/outcomeGradeId fields
  // recordGradeDecision() already writes and audits — never inferred or
  // guessed. A student's very first placement (no prior row at all) is
  // "Regular" by definition, not a guess.
  const priorRows = await prisma.gradeHistory.findMany({
    where: {
      studentId: { in: roster.map((r) => r.studentId) },
      academicSessionId: { not: targetSession.id },
    },
    include: { academicSession: true },
    orderBy: { academicSession: { startDate: "desc" } },
  });
  const mostRecentPriorByStudent = new Map<string, (typeof priorRows)[number]>();
  for (const r of priorRows) {
    if (!mostRecentPriorByStudent.has(r.studentId)) mostRecentPriorByStudent.set(r.studentId, r);
  }
  const isRepeatedByStudentId = new Map<string, boolean>();
  for (const r of roster) {
    const prior = mostRecentPriorByStudent.get(r.studentId);
    isRepeatedByStudentId.set(r.studentId, !!prior && prior.status === "REPEATED" && prior.outcomeGradeId === params.schoolGradeId);
  }

  // Ranking basis: published results only, computed entirely through
  // the existing central calculation engine (fetchAssessmentResults()
  // audience "STUDENT" already filters to PUBLISHED; computeUnweightedGPA()/
  // computeUnweightedAveragePercentage() are the same functions the
  // Report Card and dashboards already use) — nothing recalculated here,
  // nothing persisted. A student with zero published subjects has no
  // score and is excluded from ranking, not ranked last.
  const scoreByStudentId = new Map<string, { score: number; basis: "GPA" | "PERCENTAGE"; label: string } | null>();
  await Promise.all(
    roster.map(async (r) => {
      const { subjects, gpa } = await fetchAssessmentResults(r.studentId, "STUDENT");
      if (subjects.length === 0) {
        scoreByStudentId.set(r.studentId, null);
        return;
      }
      if (typeof gpa === "number") {
        scoreByStudentId.set(r.studentId, { score: gpa, basis: "GPA", label: gpa.toFixed(2) });
        return;
      }
      const avgPercent = computeUnweightedAveragePercentage(subjects);
      if (typeof avgPercent === "number") {
        scoreByStudentId.set(r.studentId, { score: avgPercent, basis: "PERCENTAGE", label: `${avgPercent.toFixed(1)}%` });
        return;
      }
      scoreByStudentId.set(r.studentId, null);
    })
  );

  const rankedStudentIds = [...scoreByStudentId.entries()]
    .filter((entry): entry is [string, { score: number; basis: "GPA" | "PERCENTAGE"; label: string }] => entry[1] !== null)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([studentId]) => studentId);

  const anyPublishedResults = [...scoreByStudentId.values()].some((v) => v !== null);
  const assessmentStatus: "NO_FRAMEWORK" | "IN_PROGRESS" | "PUBLISHED" =
    frameworkAssignmentCount === 0 ? "NO_FRAMEWORK" : anyPublishedResults ? "PUBLISHED" : "IN_PROGRESS";

  // Roll No. (a display-only position, not a stored field — see the
  // roster below) restarts per section, matching how real class roll
  // numbers actually work — computed from the section each student's
  // CURRENT-session GradeHistory row itself carries, never inferred
  // from any older record. Sections come out already alphabetically
  // consistent since `roster` is fetched in student-name order and
  // this only tracks a running count per section as it iterates.
  const rollNoCounters = new Map<string | null, number>();
  const rollNoByGradeHistoryId = new Map<string, string>();
  for (const r of roster) {
    const key = r.section?.name ?? null;
    const next = (rollNoCounters.get(key) ?? 0) + 1;
    rollNoCounters.set(key, next);
    rollNoByGradeHistoryId.set(r.id, String(next).padStart(2, "0"));
  }

  return (
    <PromotionRoster
      schoolId={schoolId}
      schoolGrade={{
        id: schoolGrade.id,
        displayName: schoolGrade.displayName,
        gradeReference: { code: schoolGrade.gradeReference.code, order: schoolGrade.gradeReference.order },
      }}
      academicSessionName={targetSession.name}
      isClosedSession={targetSession.status !== "ACTIVE"}
      roster={roster.map((r) => {
        const score = scoreByStudentId.get(r.studentId) ?? null;
        const rank = rankedStudentIds.indexOf(r.studentId);
        return {
          gradeHistoryId: r.id,
          studentId: r.studentId,
          studentName: r.student.user.name,
          avatarUrl: r.student.user.avatarUrl,
          sectionId: r.sectionId,
          sectionName: r.section?.name ?? null,
          rollNo: rollNoByGradeHistoryId.get(r.id)!,
          isRepeated: isRepeatedByStudentId.get(r.studentId) ?? false,
          resultLabel: score?.label ?? null,
          rank: rank === -1 ? null : rank + 1,
        };
      })}
      allSchoolGrades={allSchoolGrades.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        gradeReference: { code: g.gradeReference.code, order: g.gradeReference.order },
      }))}
      sections={gradeSections.map((s) => ({ id: s.id, name: s.name }))}
      teacherAssignments={teacherAssignments.map((a) => ({
        id: a.id,
        teacherName: a.teacher.user.name,
        subjectName: a.subject.name,
        sectionName: a.section?.name ?? null,
      }))}
      assessmentStatus={assessmentStatus}
    />
  );
}
