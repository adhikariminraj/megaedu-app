import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeacherAssignment } from "@/lib/authorize";
import UnitsClient from "./UnitsClient";

export const dynamic = "force-dynamic";

export default async function GradeSubjectUnitsPage({
  params,
  searchParams,
}: {
  params: { gradeSubjectId: string };
  searchParams: { section?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { schoolGrade: true, subject: true, academicSession: true },
  });
  if (!gradeSubject) notFound();
  const schoolId = gradeSubject.schoolGrade.schoolId;

  const schoolAdmin = await prisma.schoolAdmin.findFirst({ where: { userId, schoolId } });
  const isAdmin = !!schoolAdmin;

  let editableSectionIds = new Set<string>();
  let canEditGradeWide = isAdmin;
  let myTeacherId: string | null = null;

  if (!isAdmin) {
    const teacher = await prisma.teacher.findFirst({ where: { userId, schoolId, approved: true } });
    if (!teacher) redirect("/dashboard");
    myTeacherId = teacher.id;
    const anyAccess = await requireTeacherAssignment(schoolId, {
      academicSessionId: gradeSubject.academicSessionId,
      schoolGradeId: gradeSubject.schoolGradeId,
      subjectId: gradeSubject.subjectId,
    });
    if (!anyAccess) redirect("/dashboard");

    const myAssignments = await prisma.teacherAcademicAssignment.findMany({
      where: {
        teacherId: teacher.id,
        gradeSubjectId: params.gradeSubjectId,
      },
    });
    for (const a of myAssignments) {
      if (a.sectionId === null) canEditGradeWide = true;
      else editableSectionIds.add(a.sectionId);
    }
    // A grade-wide assignment covers every section for editing too.
    if (canEditGradeWide) {
      const allSections = await prisma.section.findMany({
        where: { schoolGradeId: gradeSubject.schoolGradeId, isActive: true },
        select: { id: true },
      });
      editableSectionIds = new Set(allSections.map((s) => s.id));
    }
  } else {
    canEditGradeWide = true;
    const allSections = await prisma.section.findMany({
      where: { schoolGradeId: gradeSubject.schoolGradeId, isActive: true },
      select: { id: true },
    });
    editableSectionIds = new Set(allSections.map((s) => s.id));
  }

  const sections = await prisma.section.findMany({
    where: { schoolGradeId: gradeSubject.schoolGradeId, isActive: true },
    orderBy: { name: "asc" },
  });

  const selectedSectionId = searchParams.section && sections.some((s) => s.id === searchParams.section)
    ? searchParams.section
    : null;

  const [plan, units, roster] = await Promise.all([
    prisma.teachingPlan.findFirst({
      where: { gradeSubjectId: params.gradeSubjectId, sectionId: selectedSectionId },
    }),
    prisma.teachingUnit.findMany({
      where: { gradeSubjectId: params.gradeSubjectId, sectionId: selectedSectionId },
      orderBy: { order: "asc" },
      include: {
        tests: {
          include: { results: { include: { student: { include: { user: true } } } } },
          orderBy: { testDate: "asc" },
        },
      },
    }),
    prisma.gradeHistory.findMany({
      where: {
        schoolGradeId: gradeSubject.schoolGradeId,
        academicSessionId: gradeSubject.academicSessionId,
        ...(selectedSectionId ? { sectionId: selectedSectionId } : {}),
      },
      include: { student: { include: { user: true } } },
      orderBy: { student: { user: { name: "asc" } } },
    }),
  ]);

  const subjectTeacherOptions = isAdmin
    ? await prisma.teacherAcademicAssignment.findMany({
        where: {
          schoolGradeId: gradeSubject.schoolGradeId,
          academicSessionId: gradeSubject.academicSessionId,
          subjectId: gradeSubject.subjectId,
          OR: [{ sectionId: null }, { sectionId: selectedSectionId }],
        },
        include: { teacher: { include: { user: true } } },
      })
    : [];

  const evaluations = await prisma.studentEvaluation.findMany({
    where: {
      studentId: { in: roster.map((r) => r.studentId) },
      academicSessionId: gradeSubject.academicSessionId,
      gradeSubjectId: params.gradeSubjectId,
    },
    include: { teacher: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });
  const evaluationsByStudent = new Map<string, typeof evaluations>();
  for (const ev of evaluations) {
    const list = evaluationsByStudent.get(ev.studentId) ?? [];
    list.push(ev);
    evaluationsByStudent.set(ev.studentId, list);
  }

  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: {
      studentId: { in: roster.map((r) => r.studentId) },
      gradeSubjectId: params.gradeSubjectId,
    },
    include: { teacher: { include: { user: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  const meetingsByStudent = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const list = meetingsByStudent.get(m.studentId) ?? [];
    list.push(m);
    meetingsByStudent.set(m.studentId, list);
  }

  return (
    <UnitsClient
      schoolId={schoolId}
      schoolGradeId={gradeSubject.schoolGradeId}
      gradeSubjectId={params.gradeSubjectId}
      gradeDisplayName={gradeSubject.schoolGrade.displayName}
      subjectName={gradeSubject.subject.name}
      sessionName={gradeSubject.academicSession.name}
      sections={sections.map((s) => ({ id: s.id, name: s.name }))}
      selectedSectionId={selectedSectionId}
      canEdit={selectedSectionId ? editableSectionIds.has(selectedSectionId) : canEditGradeWide}
      isAdmin={isAdmin}
      myTeacherId={myTeacherId}
      subjectTeacherOptions={subjectTeacherOptions.map((t) => ({ id: t.teacherId, name: t.teacher.user.name }))}
      evaluationRoster={roster.map((r) => ({
        studentId: r.studentId,
        studentName: r.student.user.name,
        evaluations: (evaluationsByStudent.get(r.studentId) ?? []).map((ev) => ({
          id: ev.id,
          teacherId: ev.teacherId,
          teacherName: ev.teacher.user.name,
          remarks: ev.remarks,
          visibleToParent: ev.visibleToParent,
          visibleToStudent: ev.visibleToStudent,
        })),
        meetings: (meetingsByStudent.get(r.studentId) ?? []).map((m) => ({
          id: m.id,
          teacherId: m.teacherId,
          teacherName: m.teacher.user.name,
          scheduledAt: m.scheduledAt.toISOString(),
          location: m.location,
          onlineUrl: m.onlineUrl,
          status: m.status,
          outcomeNotes: m.outcomeNotes,
        })),
      }))}
      plan={plan ? { plannedTotal: plan.plannedTotal, unitLabel: plan.unitLabel } : null}
      units={units.map((u) => ({
        id: u.id,
        title: u.title,
        order: u.order,
        status: u.status,
        tests: u.tests.map((t) => ({
          id: t.id,
          title: t.title,
          testDate: t.testDate.toISOString().slice(0, 10),
          maxMarks: t.maxMarks,
          results: t.results.map((r) => ({
            studentId: r.studentId,
            studentName: r.student.user.name,
            status: r.status,
            marksObtained: r.marksObtained,
            remarks: r.remarks,
          })),
        })),
      }))}
    />
  );
}
