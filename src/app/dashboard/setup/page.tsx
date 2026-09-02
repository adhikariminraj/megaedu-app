import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchLegacyGradeText } from "@/lib/gradeMatching";
import SetupWizard from "./SetupWizard";

type TeacherAssignmentWithNames = Prisma.TeacherGradeAssignmentGetPayload<{
  include: { teacher: { include: { user: true } }; schoolGrade: true };
}>;

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  // Same "resolve my own school" pattern the main dashboard router uses
  // for School Admin — this page has no schoolId in its URL, so there's
  // nothing for requireSchoolAdmin to check yet. Every mutation this
  // wizard triggers goes through an API route that does call it.
  const schoolAdmin = await prisma.schoolAdmin.findFirst({
    where: { userId },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");

  const schoolId = schoolAdmin.school.id;

  const [gradeReferences, schoolGrades, activeSession, teachers, students, sections] = await Promise.all([
    prisma.gradeReference.findMany({ orderBy: { order: "asc" } }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    }),
    prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } }),
    prisma.teacher.findMany({
      where: { schoolId, approved: true },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.student.findMany({
      where: { schoolId, approved: true },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.section.findMany({
      where: { schoolGrade: { schoolId } },
      orderBy: { name: "asc" },
    }),
  ]);

  type PlacementWithNames = Prisma.GradeHistoryGetPayload<{
    include: { student: { include: { user: true } }; schoolGrade: true; section: true };
  }>;

  let teacherAssignments: TeacherAssignmentWithNames[] = [];
  let gradeHistories: PlacementWithNames[] = [];
  if (activeSession) {
    [teacherAssignments, gradeHistories] = await Promise.all([
      prisma.teacherGradeAssignment.findMany({
        where: { academicSessionId: activeSession.id },
        include: { teacher: { include: { user: true } }, schoolGrade: true },
      }),
      prisma.gradeHistory.findMany({
        where: { academicSessionId: activeSession.id },
        include: { student: { include: { user: true } }, schoolGrade: true, section: true },
      }),
    ]);
  }

  // Pre-compute match suggestions for every approved student not yet
  // placed this session — the matching utility never guesses, so
  // anything without a confident match naturally lands in the manual
  // queue the wizard renders below.
  const placedStudentIds = new Set(gradeHistories.map((g) => g.studentId));
  const unplacedStudents = students.filter((s) => !placedStudentIds.has(s.id));
  const suggestions = unplacedStudents.map((s) => ({
    studentId: s.id,
    name: s.fullName,
    gradeLevel: s.gradeLevel,
    suggestedCode: matchLegacyGradeText(s.gradeLevel),
  }));

  return (
    <SetupWizard
      schoolId={schoolId}
      schoolName={schoolAdmin.school.name}
      gradeReferences={gradeReferences}
      schoolGrades={schoolGrades.map((g) => ({
        id: g.id,
        gradeReferenceId: g.gradeReferenceId,
        displayName: g.displayName,
        gradeReference: { code: g.gradeReference.code, order: g.gradeReference.order },
      }))}
      activeSession={
        activeSession
          ? {
              id: activeSession.id,
              name: activeSession.name,
              startDate: activeSession.startDate,
              endDate: activeSession.endDate,
              status: activeSession.status,
            }
          : null
      }
      teachers={teachers.map((t) => ({ id: t.id, name: t.fullName, email: t.user?.email ?? null }))}
      teacherAssignments={teacherAssignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        schoolGradeId: a.schoolGradeId,
        teacherName: a.teacher.fullName,
        gradeDisplayName: a.schoolGrade.displayName,
      }))}
      totalApprovedStudents={students.length}
      placedCount={gradeHistories.length}
      suggestions={suggestions}
      sections={sections.map((s) => ({
        id: s.id,
        schoolGradeId: s.schoolGradeId,
        name: s.name,
        isActive: s.isActive,
      }))}
      placedStudents={gradeHistories.map((g) => ({
        gradeHistoryId: g.id,
        studentId: g.studentId,
        studentName: g.student.fullName,
        schoolGradeId: g.schoolGradeId,
        gradeDisplayName: g.schoolGrade.displayName,
        sectionId: g.sectionId,
        sectionName: g.section?.name ?? null,
      }))}
    />
  );
}
