import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = typeof prisma | Prisma.TransactionClient;

/**
 * Classifies every GradeHistory row in one (still-active, about to
 * close) session into the three outcomes New Session creation cares
 * about — used for the pre-close preview on /dashboard/sessions/new.
 */
export async function classifySessionForRollover(schoolId: string, sessionId: string) {
  // Phase 4A: membership sourced from StudentSchoolAffiliation (ACTIVE
  // only — rollover concerns currently-enrolled students), not the
  // Student.schoolId/approved bridge fields.
  const rows = await prisma.gradeHistory.findMany({
    where: {
      academicSessionId: sessionId,
      student: { schoolAffiliations: { some: { schoolId, status: "ACTIVE" } } },
    },
    include: {
      student: true,
      schoolGrade: { include: { gradeReference: true } },
      outcomeGrade: { include: { gradeReference: true } },
    },
    orderBy: { student: { fullName: "asc" } },
  });

  return {
    carryForward: rows.filter(
      (r) => (r.status === "COMPLETED" || r.status === "REPEATED") && r.outcomeGradeId
    ),
    leftOrTransferred: rows.filter((r) => r.status === "TRANSFERRED" || r.status === "LEFT"),
    pending: rows.filter((r) => r.status === "ENROLLED"),
  };
}

/**
 * Finds every approved student at a school whose most recent
 * GradeHistory row (across ALL sessions, not just the prior one) is
 * still ENROLLED with no decision ever recorded, AND who has no row
 * yet in the current active session. This is deliberately
 * session-agnostic beyond "most recent" — a student left pending after
 * one rollover stays pending across any number of further rollovers
 * until someone actually resolves them, never silently dropped.
 */
export async function findPendingStudents(schoolId: string, activeSessionId: string | null) {
  // Phase 4A: membership sourced from StudentSchoolAffiliation (ACTIVE
  // only), not the Student.schoolId/approved bridge fields.
  const affiliations = await prisma.studentSchoolAffiliation.findMany({
    where: { schoolId, status: "ACTIVE" },
    select: { studentId: true },
  });
  const students = affiliations.map((a) => ({ id: a.studentId }));
  if (students.length === 0) return [];

  const allHistories = await prisma.gradeHistory.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    include: {
      academicSession: true,
      student: true,
      schoolGrade: { include: { gradeReference: true } },
    },
    orderBy: { academicSession: { startDate: "desc" } },
  });

  const mostRecentByStudent = new Map<string, (typeof allHistories)[number]>();
  for (const h of allHistories) {
    if (!mostRecentByStudent.has(h.studentId)) mostRecentByStudent.set(h.studentId, h);
  }

  return [...mostRecentByStudent.values()].filter(
    (h) => h.status === "ENROLLED" && h.academicSessionId !== activeSessionId
  );
}

/**
 * Places every currently-eligible student (most recent row is
 * COMPLETED/REPEATED with a real outcomeGradeId, and they don't already
 * have a row in the target session) into the target session, at their
 * recorded outcome grade. A direct GradeHistory creation — like Initial
 * Setup, this is a new placement, not a decision, so it does NOT go
 * through recordGradeDecision(). Idempotent and re-runnable: callable
 * once automatically right after a rollover, and again later whenever
 * a previously-pending student finally gets a decision recorded, so
 * catching up doesn't require a background job.
 */
export async function carryForwardEligibleStudents(
  schoolId: string,
  targetSessionId: string,
  client: Client = prisma
) {
  // Phase 4A: membership sourced from StudentSchoolAffiliation (ACTIVE
  // only), not the Student.schoolId/approved bridge fields.
  const affiliations = await client.studentSchoolAffiliation.findMany({
    where: { schoolId, status: "ACTIVE" },
    select: { studentId: true },
  });
  const students = affiliations.map((a) => ({ id: a.studentId }));
  if (students.length === 0) return { placed: 0 };

  const allHistories = await client.gradeHistory.findMany({
    where: { studentId: { in: students.map((s) => s.id) } },
    include: { academicSession: true },
    orderBy: { academicSession: { startDate: "desc" } },
  });
  const mostRecentByStudent = new Map<string, (typeof allHistories)[number]>();
  for (const h of allHistories) {
    if (!mostRecentByStudent.has(h.studentId)) mostRecentByStudent.set(h.studentId, h);
  }

  let placed = 0;
  for (const [studentId, mostRecent] of mostRecentByStudent) {
    if (mostRecent.academicSessionId === targetSessionId) continue; // already placed this session
    const eligible =
      (mostRecent.status === "COMPLETED" || mostRecent.status === "REPEATED") && mostRecent.outcomeGradeId;
    if (!eligible) continue; // still ENROLLED (pending) or TRANSFERRED/LEFT (no outcome, correctly stays unplaced)

    try {
      await client.gradeHistory.create({
        data: {
          studentId,
          schoolGradeId: mostRecent.outcomeGradeId!,
          academicSessionId: targetSessionId,
          status: "ENROLLED",
        },
      });
      placed++;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }

  return { placed };
}
