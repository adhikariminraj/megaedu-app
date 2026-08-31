import Link from "next/link";
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

  const gradeNameById = Object.fromEntries(schoolGrades.map((g) => [g.id, g.displayName]));
  const appliedToByFrameworkId: Record<string, string[]> = {};
  for (const a of assignments) {
    const grade = gradeNameById[a.schoolGradeId] || "—";
    const label = a.subjectName ? `${grade} — ${a.subjectName}` : `${grade} — all subjects`;
    (appliedToByFrameworkId[a.frameworkId] ||= []).push(label);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Assessment Frameworks</h1>
      <p className="text-sm text-slate-500 mb-8">{schoolAdmin.school.name}</p>

      <Link
        href="/dashboard/assessment-frameworks/new"
        className="block border-2 border-mega-navy rounded-xl px-5 py-4 text-sm font-semibold text-mega-navy mb-8 hover:bg-slate-50 transition"
      >
        + Create Assessment System
        <p className="text-xs text-slate-400 font-normal mt-1">
          A guided setup — name it, add assessments, choose how results are shown, and apply it to a class or subject.
        </p>
      </Link>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Your Assessment Systems</h2>
        {frameworks.length === 0 ? (
          <p className="text-slate-400 text-sm">None yet — create your first one above.</p>
        ) : (
          <div className="space-y-2">
            {frameworks.map((f) => (
              <div key={f.id} className="border border-slate-200 rounded-xl px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    {f.name}
                    {!f.isActive && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(appliedToByFrameworkId[f.id] || []).length > 0
                    ? `Applied to: ${appliedToByFrameworkId[f.id].join(", ")}`
                    : "Not applied to any class or subject yet"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <details className="border border-slate-200 rounded-xl">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
          Advanced management (edit assessments, grade levels, and application details)
        </summary>
        <div className="border-t border-slate-200 px-1 pt-4">
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
        </div>
      </details>
    </div>
  );
}
