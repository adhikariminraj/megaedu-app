import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AcademicStructureClient from "./AcademicStructureClient";

export const dynamic = "force-dynamic";

export default async function AcademicsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({
    where: { userId },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

  const [subjects, schoolGrades, teachers] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: {
        gradeReference: true,
        sections: { where: { isActive: true }, orderBy: { name: "asc" } },
      },
      orderBy: { gradeReference: { order: "asc" } },
    }),
    prisma.teacher.findMany({
      where: { schoolId, approved: true },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  let gradeSubjectsByGrade: Record<string, { id: string; subjectId: string; subjectName: string }[]> = {};
  let assignmentsByGrade: Record<
    string,
    { id: string; teacherId: string; teacherName: string; subjectId: string; subjectName: string; sectionId: string | null; sectionName: string | null }[]
  > = {};
  let classTeachersByGrade: Record<
    string,
    { id: string; teacherId: string; teacherName: string; sectionId: string | null; sectionName: string | null }[]
  > = {};

  if (activeSession) {
    const [gradeSubjects, assignments, classTeacherAssignments] = await Promise.all([
      prisma.gradeSubject.findMany({
        where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } },
      }),
      prisma.teacherAcademicAssignment.findMany({
        where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
        include: { teacher: { include: { user: true } }, subject: true, section: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.classTeacherAssignment.findMany({
        where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
        include: { teacher: { include: { user: true } }, section: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    gradeSubjectsByGrade = {};
    for (const gs of gradeSubjects) {
      (gradeSubjectsByGrade[gs.schoolGradeId] ||= []).push({
        id: gs.id,
        subjectId: gs.subjectId,
        subjectName: gs.subject.name,
      });
    }

    assignmentsByGrade = {};
    for (const a of assignments) {
      (assignmentsByGrade[a.schoolGradeId] ||= []).push({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: a.teacher.user.name,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        sectionId: a.sectionId,
        sectionName: a.section?.name ?? null,
      });
    }

    classTeachersByGrade = {};
    for (const c of classTeacherAssignments) {
      (classTeachersByGrade[c.schoolGradeId] ||= []).push({
        id: c.id,
        teacherId: c.teacherId,
        teacherName: c.teacher.user.name,
        sectionId: c.sectionId,
        sectionName: c.section?.name ?? null,
      });
    }
  }

  return (
    <AcademicStructureClient
      schoolId={schoolId}
      schoolName={schoolAdmin.school.name}
      activeSession={activeSession ? { id: activeSession.id, name: activeSession.name } : null}
      subjects={subjects.map((s) => ({ id: s.id, name: s.name, isActive: s.isActive }))}
      grades={schoolGrades.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        sections: g.sections.map((s) => ({ id: s.id, name: s.name })),
        offeredSubjects: gradeSubjectsByGrade[g.id] || [],
        assignments: assignmentsByGrade[g.id] || [],
        classTeachers: classTeachersByGrade[g.id] || [],
      }))}
      teachers={teachers.map((t) => ({ id: t.id, name: t.user.name }))}
    />
  );
}
