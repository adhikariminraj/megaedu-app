import { prisma } from "@/lib/prisma";
import { resolveStudentPlacementInSession } from "@/lib/gradeHistory";
import { requireTeacherAssignment } from "@/lib/authorize";

/**
 * The pure decision behind Subject Teacher authorization for a Homework/
 * HomeworkApplicability — originally built for K2 Completion (see the K2
 * authorization clarification) and reused UNCHANGED by K4 Review, since
 * both ask the identical question: "which section scope should this
 * teacher's TeacherAcademicAssignment be checked against for this
 * Homework." Deliberately factored out so it's independently testable
 * without a live session: session resolution and the actual
 * TeacherAcademicAssignment match (requireTeacherAssignment(),
 * src/lib/authorize.ts) are unchanged, already-proven code — this
 * function's only job is producing the correct `sectionId` SCOPE to
 * check that assignment against.
 *
 * Regular Homework: the Homework's own frozen sectionId, unchanged —
 * no per-student resolution needed, since Regular Homework's
 * authorization question is "does this teacher teach the Homework's own
 * declared scope," not "does this teacher teach this particular
 * student."
 *
 * Individual Homework: Homework.sectionId is always null by K1 design,
 * which must be read as neither "any section" nor "grade-wide only."
 * Freshly resolves the target student's placement WITHIN THIS
 * HOMEWORK'S OWN academicSessionId/schoolGradeId (never the school's
 * currently-ACTIVE session — see resolveStudentPlacementInSession()'s
 * own doc comment for why that distinction matters). If the student is
 * still there (even in a different section than when the homework was
 * created — "disassociate != delete" for HISTORY, but authorization is
 * always a CURRENT check), authorize against their current section
 * (grade-wide OR that exact section). If the student has since
 * transferred out of this grade or left the school entirely (no
 * current-roster placement), fall back to grade-wide-only — a teacher
 * whose assignment was only ever section-specific has no remaining
 * basis to record for a student no longer anywhere in this grade. This
 * NEVER reads, rewrites, or re-derives HomeworkApplicability itself.
 */
export async function resolveSubjectTeacherAuthorizationScope(
  homework: { academicSessionId: string; schoolGradeId: string; sectionId: string | null; targetStudentId: string | null }
): Promise<string | null> {
  if (!homework.targetStudentId) return homework.sectionId;

  const placement = await resolveStudentPlacementInSession(
    homework.targetStudentId,
    homework.academicSessionId,
    homework.schoolGradeId
  );
  return placement ? placement.sectionId : null;
}

export type ApplicabilityAccess =
  | { role: "STUDENT" }
  | { role: "PARENT" }
  | { role: "TEACHER"; teacherId: string };

type ApplicabilityWithHomework = {
  studentId: string;
  homework: {
    schoolGradeId: string;
    academicSessionId: string;
    sectionId: string | null;
    subjectId: string;
    targetStudentId: string | null;
  };
};

/**
 * K3/K4/K6 — the one shared answer to "who is this session, relative to
 * this HomeworkApplicability." Three mutually exclusive roles:
 *
 *  - STUDENT: the session's own Student identity IS the applicability's
 *    studentId — the only role that may WRITE a SubmissionAttempt (K3).
 *  - PARENT: the session's Parent identity has a ParentStudent link to
 *    the applicability's student — reused view-only everywhere in K3/K4/
 *    K6, matching the "Parents are read-only recipients" precedent
 *    already established for Meetings. Parent is NEVER authorized to
 *    write anything here.
 *  - TEACHER: the session holds a CURRENT TeacherAcademicAssignment
 *    matching resolveSubjectTeacherAuthorizationScope()'s scope for this
 *    Homework, via requireTeacherAssignment() — the identical,
 *    unmodified K2 authorization rule, never reimplemented. The only
 *    role that may WRITE a HomeworkCompletion (K2) or HomeworkReview
 *    (K4). No School Admin/Class Teacher/Grade Coordinator bypass exists
 *    or is checked here, by design.
 *
 * schoolId must be the applicability's own school (resolved by the
 * caller from homework.schoolGrade.schoolId) — never inferred, matching
 * every other requireTeacherAssignment() call site in this codebase.
 * Returns null if the current session matches none of the three roles.
 */
export async function resolveApplicabilityAccess(
  userId: string,
  applicability: ApplicabilityWithHomework,
  schoolId: string
): Promise<ApplicabilityAccess | null> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (student && student.id === applicability.studentId) {
    return { role: "STUDENT" };
  }

  const parentLink = await prisma.parentStudent.findFirst({
    where: { studentId: applicability.studentId, parent: { userId } },
  });
  if (parentLink) {
    return { role: "PARENT" };
  }

  const sectionId = await resolveSubjectTeacherAuthorizationScope(applicability.homework);
  const teacherUserId = await requireTeacherAssignment(schoolId, {
    academicSessionId: applicability.homework.academicSessionId,
    schoolGradeId: applicability.homework.schoolGradeId,
    sectionId,
    subjectId: applicability.homework.subjectId,
  });
  if (teacherUserId) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
    if (teacher) return { role: "TEACHER", teacherId: teacher.id };
  }

  return null;
}
