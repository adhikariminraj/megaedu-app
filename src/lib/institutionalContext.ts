import { prisma } from "@/lib/prisma";

/**
 * Phase 4D-1 — institutional context foundation.
 *
 * Affiliation → accessible schools → current URL context → authorization.
 *
 * ACTIVE affiliations alone define what a person can select or reach
 * here — PENDING is deliberately excluded. Unlike the Phase 4A roster
 * views (where PENDING must stay visible so an admin can review and
 * approve it), this module answers a different question: "where can
 * this person actually operate right now," which a not-yet-approved
 * relationship cannot yet answer yes to.
 *
 * Scope: School Admin and Teacher only, matching the approved Phase
 * 4D-1 proof-of-concept. Student is deliberately not included —
 * simultaneous multi-school policy for Student remains undecided, and
 * extending this module to Student is explicit future work, not a
 * silent side effect of this one.
 *
 * Nothing here is ever trusted as authorization by itself.
 * getAccessibleSchools() only builds a list/UI. verifySchoolAccess()
 * is the only function whose result may gate a render or an action,
 * and it re-queries fresh every call — no caching, so ending an
 * affiliation takes effect on the very next request.
 */

export type AccessibleSchool = {
  schoolId: string;
  schoolName: string;
  role: "SCHOOL_ADMIN" | "TEACHER";
};

export type SchoolAccess =
  | { role: "SCHOOL_ADMIN" }
  | { role: "TEACHER"; teacherId: string };

export const SCHOOL_CONTEXT_COOKIE = "mega_school_ctx";

/**
 * Every school this person can currently select — ACTIVE School Admin
 * links plus ACTIVE TeacherSchoolAffiliation rows. Display/routing
 * input only; never itself a security decision.
 */
export async function getAccessibleSchools(userId: string): Promise<AccessibleSchool[]> {
  const [adminLinks, teacherAffiliations] = await Promise.all([
    prisma.schoolAdmin.findMany({
      where: { userId },
      include: { school: { select: { id: true, name: true } } },
    }),
    prisma.teacherSchoolAffiliation.findMany({
      where: { teacher: { userId }, status: "ACTIVE" },
      include: { school: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return [
    ...adminLinks.map((a) => ({ schoolId: a.school.id, schoolName: a.school.name, role: "SCHOOL_ADMIN" as const })),
    ...teacherAffiliations.map((t) => ({ schoolId: t.school.id, schoolName: t.school.name, role: "TEACHER" as const })),
  ];
}

/**
 * The real gate. Re-verifies, fresh, that userId currently has an
 * exact School Admin link or an ACTIVE TeacherSchoolAffiliation with
 * schoolId — independent of any cookie, URL history, or prior render.
 * Returns null (fail closed) for PENDING, ENDED, or no relationship at
 * all with this specific school.
 */
export async function verifySchoolAccess(userId: string, schoolId: string): Promise<SchoolAccess | null> {
  const admin = await prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId } } });
  if (admin) return { role: "SCHOOL_ADMIN" };

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (teacher) {
    const affiliation = await prisma.teacherSchoolAffiliation.findFirst({
      where: { teacherId: teacher.id, schoolId, status: "ACTIVE" },
    });
    if (affiliation) return { role: "TEACHER", teacherId: teacher.id };
  }

  return null;
}
