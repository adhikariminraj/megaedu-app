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

  if (!isAdmin) {
    const teacher = await prisma.teacher.findFirst({ where: { userId, schoolId, approved: true } });
    if (!teacher) redirect("/dashboard");
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

  const [plan, units] = await Promise.all([
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
  ]);

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
