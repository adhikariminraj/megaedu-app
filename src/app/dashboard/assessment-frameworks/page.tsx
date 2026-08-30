import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AssessmentFrameworksClient from "./AssessmentFrameworksClient";

export const dynamic = "force-dynamic";

/**
 * Phase 3D-1 School Admin configuration surface: define reusable
 * GradingScales and AssessmentFrameworks (with their periods/
 * components), then assign a framework to a grade (default) or a
 * specific subject (override) for the active academic session. Purely
 * configuration — no marks entry, calculation, or report cards exist
 * yet (see docs/ASSESSMENT_FRAMEWORK.md). School-Admin-only, mirroring
 * every other Phase 3A/3B academic-structure config page.
 */
export default async function AssessmentFrameworksPage() {
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

  const [gradingScales, frameworks, schoolGrades] = await Promise.all([
    prisma.gradingScale.findMany({
      where: { schoolId },
      include: { bands: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.assessmentFramework.findMany({
      where: { schoolId },
      include: {
        periods: { orderBy: { order: "asc" } },
        components: { orderBy: { order: "asc" } },
        gradingScale: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    }),
  ]);

  let gradeSubjectsByGrade: Record<string, { id: string; subjectName: string }[]> = {};
  let assignments: {
    id: string;
    schoolGradeId: string;
    gradeSubjectId: string | null;
    subjectName: string | null;
    frameworkId: string;
    frameworkName: string;
  }[] = [];

  if (activeSession) {
    const [gradeSubjects, assignmentRows] = await Promise.all([
      prisma.gradeSubject.findMany({
        where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } },
      }),
      prisma.assessmentFrameworkAssignment.findMany({
        where: { academicSessionId: activeSession.id, schoolId },
        include: { framework: true, gradeSubject: { include: { subject: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    gradeSubjectsByGrade = {};
    for (const gs of gradeSubjects) {
      (gradeSubjectsByGrade[gs.schoolGradeId] ||= []).push({ id: gs.id, subjectName: gs.subject.name });
    }

    assignments = assignmentRows.map((a) => ({
      id: a.id,
      schoolGradeId: a.schoolGradeId,
      gradeSubjectId: a.gradeSubjectId,
      subjectName: a.gradeSubject?.subject.name ?? null,
      frameworkId: a.frameworkId,
      frameworkName: a.framework.name,
    }));
  }

  return (
    <AssessmentFrameworksClient
      schoolId={schoolId}
      schoolName={schoolAdmin.school.name}
      activeSession={activeSession ? { id: activeSession.id, name: activeSession.name } : null}
      gradingScales={gradingScales.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        bands: s.bands.map((b) => ({
          id: b.id,
          minPercent: b.minPercent,
          maxPercent: b.maxPercent,
          label: b.label,
          gradePoint: b.gradePoint,
          description: b.description,
        })),
      }))}
      frameworks={frameworks.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        isActive: f.isActive,
        gradingScaleId: f.gradingScaleId,
        gradingScaleName: f.gradingScale?.name ?? null,
        periods: f.periods.map((p) => ({ id: p.id, name: p.name })),
        components: f.components.map((c) => ({
          id: c.id,
          periodId: c.periodId,
          name: c.name,
          maxMarks: c.maxMarks,
          entryMode: c.entryMode,
        })),
      }))}
      grades={schoolGrades.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        offeredSubjects: gradeSubjectsByGrade[g.id] || [],
      }))}
      assignments={assignments}
    />
  );
}
