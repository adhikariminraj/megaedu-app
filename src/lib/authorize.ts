import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns the userId if the current session belongs to a School Admin
 * for the given schoolId, otherwise null. Use this at the top of every
 * write route under /api/schools/[id]/* that needs full admin access.
 */
export async function requireSchoolAdmin(schoolId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const link = await prisma.schoolAdmin.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session belongs to an Organization
 * Admin for the given organizationId, otherwise null.
 */
export async function requireOrgAdmin(organizationId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const link = await prisma.organizationAdmin.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session's Organization Admin owns
 * the given course (via the course's organizationId), otherwise null.
 */
export async function requireCourseOwner(courseId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course?.organizationId) return null;

  const link = await prisma.organizationAdmin.findUnique({
    where: { userId_organizationId: { userId, organizationId: course.organizationId } },
  });
  return link ? userId : null;
}

/**
 * Returns the userId if the current session holds the PLATFORM_ADMIN
 * role, otherwise null. Use this to gate everything under /admin and
 * /api/admin/*.
 */
export async function requirePlatformAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.id) return null;
  if (!user.roles?.includes("PLATFORM_ADMIN")) return null;
  return user.id as string;
}

/**
 * Finance access for a school. Deliberately checks BOTH School Admin
 * (who retains full authority over their school, finance included) and
 * School Accountant — but this is a genuinely separate check, not a
 * fallback/reduction of requireSchoolAdmin. An Accountant who is NOT
 * also an Admin gets finance access ONLY — nothing else in the app
 * should ever call this function to gate non-finance actions.
 */
export async function requireSchoolFinance(schoolId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const [adminLink, accountantLink] = await Promise.all([
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId } } }),
    prisma.schoolAccountant.findUnique({ where: { userId_schoolId: { userId, schoolId } } }),
  ]);
  return adminLink || accountantLink ? userId : null;
}

/**
 * Given an optional sectionId "target" describing what's being acted
 * on, returns the Prisma where-clause fragment that correctly checks a
 * grade-wide-or-section-specific assignment row against it. THREE
 * distinct cases, not two — this is the Phase 3B correction to a real
 * semantic gap found before Teaching Units/Tests had their first real
 * caller (see PRODUCT_RULES.md):
 *
 * - `undefined` (omitted): no section restriction requested — match
 *   any assignment for the grade/subject regardless of section. Used
 *   for a broad "is this teacher assigned here at all" check.
 * - `null`: the target itself is grade-wide (e.g. a grade-wide
 *   TeachingUnit) — require a grade-wide assignment SPECIFICALLY. A
 *   section-specific-only teacher must NOT pass this check.
 * - a real section id: the target is that one section — a grade-wide
 *   assignment (covers every section) OR that exact section's
 *   assignment both satisfy it.
 *
 * Naively treating `null` and `undefined` the same (both falsy in JS)
 * was the original Phase 3A bug: it silently collapsed case 2 into
 * case 1, which never mattered while nothing called this function, but
 * would have wrongly authorized a section-specific-only teacher to
 * manage a grade-wide unit once Phase 3B started depending on it.
 */
export function sectionScopeWhere(sectionId: string | null | undefined) {
  if (sectionId === undefined) return {};
  if (sectionId === null) return { sectionId: null };
  return { OR: [{ sectionId: null }, { sectionId }] };
}

/**
 * Returns the userId if the current session belongs to an approved
 * Teacher at schoolId who holds a TeacherAcademicAssignment matching
 * the given scope, otherwise null. The Phase 3A/3B permission
 * foundation for teacher-facing academic features (Teaching Units,
 * Unit/Chapter Tests, and future homework/teaching-progress work).
 *
 * scope.subjectId is optional: omit it to check "is this teacher
 * assigned to this grade/section at all, for any subject"; include it
 * to check a specific subject (e.g. "can this teacher manage this Math
 * TeachingUnit").
 *
 * scope.sectionId follows the three-way semantics of sectionScopeWhere()
 * above — pass the TARGET's own sectionId (e.g. a TeachingUnit's
 * sectionId, which may itself be null for a grade-wide unit), not
 * omit it, whenever the check is about one specific thing.
 *
 * Deliberately teacher-only — does not fold in a School Admin bypass.
 * A caller that wants "Admin or the assigned Teacher" composes both
 * checks inline, the same way students/[studentId]/skills already
 * combines an inline teacher check with requireSchoolAdmin today.
 */
export async function requireTeacherAssignment(
  schoolId: string,
  scope: {
    academicSessionId: string;
    schoolGradeId: string;
    sectionId?: string | null;
    subjectId?: string;
  }
): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, approved: true },
  });
  if (!teacher) return null;

  const match = await prisma.teacherAcademicAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
      ...sectionScopeWhere(scope.sectionId),
    },
  });
  return match ? userId : null;
}

/**
 * Returns the userId if the current session belongs to an approved
 * Teacher at schoolId who holds a ClassTeacherAssignment (Grade Class
 * Teacher or Section Teacher — see PRODUCT_RULES.md) matching the
 * given scope, otherwise null. Same three-way sectionId semantics as
 * requireTeacherAssignment() above, via the same sectionScopeWhere()
 * helper — a Grade Class Teacher (sectionId: null on their row)
 * satisfies a check for any section under that grade; a Section
 * Teacher satisfies only their exact section.
 *
 * Deliberately teacher-only — does not fold in a School Admin bypass;
 * callers compose both checks inline, same pattern as every other
 * requireX helper in this file.
 */
export async function requireClassTeacher(
  schoolId: string,
  scope: {
    academicSessionId: string;
    schoolGradeId: string;
    sectionId?: string | null;
  }
): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId, approved: true },
  });
  if (!teacher) return null;

  const match = await prisma.classTeacherAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      ...sectionScopeWhere(scope.sectionId),
    },
  });
  return match ? userId : null;
}

/**
 * Checks whether a SPECIFIC teacherId (not the logged-in session) holds
 * a TeacherAcademicAssignment matching the given scope — used only when
 * a School Admin creates a StudentEvaluation "on behalf of" a named
 * teacher, where there's no session to resolve teacherId from in the
 * first place. Same sectionScopeWhere() three-way semantics as
 * requireTeacherAssignment(). Deliberately does not check `approved` —
 * that's the caller's job if it matters for the specific route.
 */
export async function teacherHoldsSubjectAssignment(
  teacherId: string,
  scope: { academicSessionId: string; schoolGradeId: string; sectionId?: string | null; subjectId: string }
): Promise<boolean> {
  const match = await prisma.teacherAcademicAssignment.findFirst({
    where: {
      teacherId,
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      subjectId: scope.subjectId,
      ...sectionScopeWhere(scope.sectionId),
    },
  });
  return !!match;
}

/**
 * Same idea as teacherHoldsSubjectAssignment() but for ClassTeacherAssignment
 * (general/pastoral scope, no subject).
 */
export async function teacherHoldsClassAssignment(
  teacherId: string,
  scope: { academicSessionId: string; schoolGradeId: string; sectionId?: string | null }
): Promise<boolean> {
  const match = await prisma.classTeacherAssignment.findFirst({
    where: {
      teacherId,
      academicSessionId: scope.academicSessionId,
      schoolGradeId: scope.schoolGradeId,
      ...sectionScopeWhere(scope.sectionId),
    },
  });
  return !!match;
}

/**
 * Finance access for an organization — same principle as
 * requireSchoolFinance, checking Organization Admin OR Organization
 * Accountant.
 */
export async function requireOrgFinance(organizationId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  const [adminLink, accountantLink] = await Promise.all([
    prisma.organizationAdmin.findUnique({ where: { userId_organizationId: { userId, organizationId } } }),
    prisma.organizationAccountant.findUnique({ where: { userId_organizationId: { userId, organizationId } } }),
  ]);
  return adminLink || accountantLink ? userId : null;
}
