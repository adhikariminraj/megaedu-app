import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import HomeworkClient from "./HomeworkClient";

export const dynamic = "force-dynamic";

/**
 * Homework — Phase 1. URL-scoped from day one (no unscoped legacy
 * sibling the way Attendance/Evaluations/Meetings have): Homework is a
 * brand-new feature with no pre-Phase-4D history to preserve, so it
 * skips straight to the pattern those features were migrated *to* —
 * verifySchoolAccess(params.schoolId), never a remembered cookie or an
 * arbitrary findFirst() pick, re-verified fresh on every request.
 */
export default async function HomeworkPage({ params }: { params: { schoolId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access) redirect("/dashboard");

  const schoolId = params.schoolId;
  const isAdmin = access.role === "SCHOOL_ADMIN";
  const teacherId = access.role === "TEACHER" ? access.teacherId : null;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Homework</h1>
        <p className="text-slate-500 text-sm">No active academic session yet.</p>
      </div>
    );
  }

  // Every (grade, subject, section-or-whole-grade) combination the
  // caller may author Homework for. Admin: everything the school
  // currently offers this session (GradeSubject × Whole-Grade-or-each-
  // active-section) — full oversight, matching the same admin-sees-
  // everything precedent as Attendance/Evaluations. Teacher: exactly
  // their own TeacherAcademicAssignment rows this session — each row
  // already IS one valid (subject, section-or-whole-grade) combination,
  // no further enumeration needed.
  type AssignmentOption = {
    key: string;
    schoolGradeId: string;
    gradeDisplayName: string;
    gradeSubjectId: string;
    subjectName: string;
    sectionId: string | null;
    sectionName: string | null;
  };

  let assignmentOptions: AssignmentOption[] = [];
  if (isAdmin) {
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
      include: {
        subject: true,
        schoolGrade: { include: { sections: { where: { isActive: true }, orderBy: { name: "asc" } } } },
      },
      orderBy: [{ schoolGrade: { gradeReference: { order: "asc" } } }, { subject: { name: "asc" } }],
    });
    assignmentOptions = gradeSubjects.flatMap((gs) => [
      {
        key: `${gs.id}|ALL`,
        schoolGradeId: gs.schoolGradeId,
        gradeDisplayName: gs.schoolGrade.displayName,
        gradeSubjectId: gs.id,
        subjectName: gs.subject.name,
        sectionId: null,
        sectionName: null,
      },
      ...gs.schoolGrade.sections.map((s) => ({
        key: `${gs.id}|${s.id}`,
        schoolGradeId: gs.schoolGradeId,
        gradeDisplayName: gs.schoolGrade.displayName,
        gradeSubjectId: gs.id,
        subjectName: gs.subject.name,
        sectionId: s.id,
        sectionName: s.name,
      })),
    ]);
  } else if (teacherId) {
    const assignments = await prisma.teacherAcademicAssignment.findMany({
      where: { teacherId, academicSessionId: activeSession.id },
      include: { schoolGrade: true, subject: true, section: true },
      orderBy: [{ schoolGrade: { gradeReference: { order: "asc" } } }, { subject: { name: "asc" } }],
    });
    assignmentOptions = assignments.map((a) => ({
      key: `${a.gradeSubjectId}|${a.sectionId ?? "ALL"}`,
      schoolGradeId: a.schoolGradeId,
      gradeDisplayName: a.schoolGrade.displayName,
      gradeSubjectId: a.gradeSubjectId,
      subjectName: a.subject.name,
      sectionId: a.sectionId,
      sectionName: a.section?.name ?? null,
    }));
  }

  // Existing homework list: Admin sees the whole school's; a Teacher
  // sees only their own — matching the identical admin-vs-teacher query
  // scoping already established by /dashboard/meetings ("Teachers see
  // and manage only their own meetings; School Admins see every
  // meeting at the school").
  const homework = await prisma.homework.findMany({
    where: isAdmin ? { schoolGrade: { schoolId } } : { teacherId: teacherId! },
    include: { subject: true, schoolGrade: true, section: true, teacher: true },
    orderBy: { dueDate: "desc" },
  });

  return (
    <HomeworkClient
      schoolId={schoolId}
      isAdmin={isAdmin}
      assignmentOptions={assignmentOptions}
      homework={homework.map((hw) => ({
        id: hw.id,
        gradeDisplayName: hw.schoolGrade.displayName,
        sectionName: hw.section?.name ?? null,
        subjectName: hw.subject.name,
        teacherName: hw.teacher.fullName,
        title: hw.title,
        instructions: hw.instructions,
        dueDate: hw.dueDate.toISOString().slice(0, 10),
        status: hw.status as "DRAFT" | "PUBLISHED",
      }))}
    />
  );
}
