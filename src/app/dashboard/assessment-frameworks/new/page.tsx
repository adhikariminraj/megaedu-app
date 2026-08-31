import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CreateAssessmentSystemWizard from "./CreateAssessmentSystemWizard";

export const dynamic = "force-dynamic";

/**
 * "Create Assessment System" — a guided, school-friendly wizard sitting
 * entirely in front of the existing Phase 3D-1 backend. Every step
 * accumulates state client-side; nothing is created until the final
 * review screen's confirm action, which then calls the exact same
 * routes AssessmentFrameworksClient.tsx already uses (POST
 * /assessment-frameworks bundling periods+components, optionally POST
 * /grading-scales first, then POST /assessment-framework-assignments).
 * No schema, route, or calculation-engine change — see
 * docs/ASSESSMENT_FRAMEWORK.md for the underlying model this wraps.
 */
export default async function CreateAssessmentSystemPage() {
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

  const [gradingScales, schoolGrades] = await Promise.all([
    prisma.gradingScale.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    }),
  ]);

  let gradeSubjectsByGrade: Record<string, { id: string; subjectName: string }[]> = {};
  if (activeSession) {
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    });
    for (const gs of gradeSubjects) {
      (gradeSubjectsByGrade[gs.schoolGradeId] ||= []).push({ id: gs.id, subjectName: gs.subject.name });
    }
  }

  return (
    <CreateAssessmentSystemWizard
      schoolId={schoolId}
      schoolName={schoolAdmin.school.name}
      activeSession={activeSession ? { id: activeSession.id, name: activeSession.name } : null}
      existingScales={gradingScales.map((s) => ({ id: s.id, name: s.name }))}
      grades={schoolGrades.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        offeredSubjects: gradeSubjectsByGrade[g.id] || [],
      }))}
    />
  );
}
