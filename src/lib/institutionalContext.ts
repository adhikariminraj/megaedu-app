import { prisma } from "@/lib/prisma";
import { requireTeacherAssignment, requireClassTeacher } from "@/lib/authorize";
import { resolveCurrentPlacement } from "@/lib/gradeHistory";

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

export type AccessibleOrganization = {
  organizationId: string;
  organizationName: string;
  role: "ORGANIZATION_ADMIN" | "ORGANIZATION_ACCOUNTANT";
};

export type OrgAccess =
  | { role: "ORGANIZATION_ADMIN" }
  | { role: "ORGANIZATION_ACCOUNTANT" };

/**
 * Organization Institutional Context foundation — the Organization-side
 * counterpart to getAccessibleSchools()/verifySchoolAccess() above,
 * approved as "Option A" in the Organization Institutional Context
 * design report: no new model, no history/status fields.
 * OrganizationAdmin/OrganizationAccountant (flat join tables, exactly
 * the same shape as SchoolAdmin/SchoolAccountant) remain the
 * authoritative institutional-context relationships; this is a
 * resolution layer over them, not a replacement for them.
 *
 * Every Organization this person can currently select — every
 * OrganizationAdmin link plus every OrganizationAccountant link.
 * Display/routing input only, never itself a security decision (see
 * verifyOrgAccess() below). Ordered by id for deterministic output —
 * OrganizationAdmin/OrganizationAccountant have no createdAt field
 * (schema unchanged, per the approved kilometer), so id order is the
 * available deterministic substitute.
 */
export async function getAccessibleOrganizations(userId: string): Promise<AccessibleOrganization[]> {
  const [adminLinks, accountantLinks] = await Promise.all([
    prisma.organizationAdmin.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.organizationAccountant.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  return [
    ...adminLinks.map((a) => ({
      organizationId: a.organization.id,
      organizationName: a.organization.name,
      role: "ORGANIZATION_ADMIN" as const,
    })),
    ...accountantLinks.map((a) => ({
      organizationId: a.organization.id,
      organizationName: a.organization.name,
      role: "ORGANIZATION_ACCOUNTANT" as const,
    })),
  ];
}

/**
 * The real gate. Re-verifies, fresh, that userId currently has an
 * exact OrganizationAdmin or OrganizationAccountant link to
 * organizationId — independent of any prior render, and never
 * inferred from the global UserRole flag alone (that flag is only a
 * routing hint — see the design report). Returns null (fail closed)
 * for no relationship at all with this specific organization.
 *
 * This is an institutional-context gate, not a replacement for
 * requireOrgAdmin()/requireCourseOwner()/requireOrgFinance() — those
 * remain responsible for their own existing role/resource-specific
 * authorization decisions and are unchanged by this function's
 * existence.
 */
export async function verifyOrgAccess(userId: string, organizationId: string): Promise<OrgAccess | null> {
  const admin = await prisma.organizationAdmin.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (admin) return { role: "ORGANIZATION_ADMIN" };

  const accountant = await prisma.organizationAccountant.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (accountant) return { role: "ORGANIZATION_ACCOUNTANT" };

  return null;
}

export type StudentViewAccess =
  | { role: "SCHOOL_ADMIN" }
  | { role: "SUBJECT_TEACHER" }
  | { role: "CLASS_TEACHER" };

/**
 * The authorization gate for the Student Profile page
 * (dashboard/students/[studentId]) — extends beyond
 * verifySchoolAccess()'s school-wide Admin/Teacher check to the
 * properly ASSIGNMENT-scoped model this specific page needs: a Subject
 * Teacher only for a student in a section they hold a
 * TeacherAcademicAssignment for; a Class Teacher/Grade Coordinator only
 * for a student in a section/grade they hold a ClassTeacherAssignment
 * for. School Admin remains school-wide, matching verifySchoolAccess()
 * exactly — unchanged.
 *
 * Parent is deliberately NOT a case here — a Parent's four Academic
 * Snapshot/identity requirements are satisfied entirely within their
 * own existing dashboard (ParentDashboard.tsx, gated by the
 * already-correct Parent.children/ParentStudent relation in
 * dashboard/page.tsx), never by granting a Parent access to this
 * shared Admin/Teacher page — which also carries Family & Emergency
 * Contacts and address-correction affordances no Parent should reach.
 *
 * Deliberately does NOT modify or narrow verifySchoolAccess() itself —
 * that function's coarser "is this person affiliated with this school
 * at all" check remains correct and unchanged for its own existing
 * callers (e.g. the Skills route). This is a new, stricter, purpose-
 * built resolver for exactly one question: "can this user view THIS
 * SPECIFIC STUDENT's profile."
 *
 * Composes existing primitives only — requireTeacherAssignment()/
 * requireClassTeacher() (src/lib/authorize.ts) against the student's
 * CURRENT placement (resolveCurrentPlacement(), src/lib/gradeHistory.ts
 * — the same school-and-session-correct resolution the Academic
 * Snapshot itself already uses). No new authorization logic is
 * invented here.
 *
 * A student with no current placement (no active GradeHistory row —
 * e.g. mid-transfer, or never placed) has no assignment-scoped Teacher
 * to authorize, by definition — only School Admin can view such a
 * student's profile.
 */
export async function resolveStudentViewAccess(
  userId: string,
  studentId: string
): Promise<StudentViewAccess | null> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || !student.schoolId) return null;

  const schoolAccess = await verifySchoolAccess(userId, student.schoolId);
  if (schoolAccess?.role === "SCHOOL_ADMIN") return { role: "SCHOOL_ADMIN" };

  if (schoolAccess?.role === "TEACHER") {
    const placement = await resolveCurrentPlacement(studentId, student.schoolId);
    if (placement) {
      const scope = {
        academicSessionId: placement.academicSessionId,
        schoolGradeId: placement.schoolGradeId,
        sectionId: placement.sectionId,
      };
      if (await requireTeacherAssignment(student.schoolId, scope)) {
        return { role: "SUBJECT_TEACHER" };
      }
      if (await requireClassTeacher(student.schoolId, scope)) {
        return { role: "CLASS_TEACHER" };
      }
    }
  }

  return null;
}
