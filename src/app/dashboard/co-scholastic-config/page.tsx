import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CoScholasticConfigClient from "./CoScholasticConfigClient";

export const dynamic = "force-dynamic";

/**
 * School Admin configuration surface for Co-Scholastic — a small,
 * deliberately simpler sibling of /dashboard/assessment-frameworks:
 * manage the school-wide area catalog (Work Education, Art, etc.), then
 * per grade+session, choose whether it uses periods (Term I/Term II)
 * and which GradingScale governs it. Reuses GradingScale unchanged —
 * no separate co-scholastic scale mechanism.
 */
export default async function CoScholasticConfigPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({ where: { userId }, include: { school: true } });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

  const [areas, gradingScales, schoolGrades] = await Promise.all([
    prisma.coScholasticArea.findMany({ where: { schoolId }, orderBy: { order: "asc" } }),
    prisma.gradingScale.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.schoolGrade.findMany({ where: { schoolId }, include: { gradeReference: true }, orderBy: { gradeReference: { order: "asc" } } }),
  ]);

  let periodsByGrade: Record<string, { id: string; name: string }[]> = {};
  let settingByGrade: Record<string, { gradingScaleId: string; gradingScaleName: string }> = {};
  if (activeSession) {
    const [periods, settings] = await Promise.all([
      prisma.coScholasticPeriod.findMany({
        where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
        orderBy: { order: "asc" },
      }),
      prisma.coScholasticGradeSetting.findMany({
        where: { academicSessionId: activeSession.id, schoolId },
        include: { gradingScale: true },
      }),
    ]);
    for (const p of periods) (periodsByGrade[p.schoolGradeId] ||= []).push({ id: p.id, name: p.name });
    for (const s of settings) settingByGrade[s.schoolGradeId] = { gradingScaleId: s.gradingScaleId, gradingScaleName: s.gradingScale.name };
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Co-Scholastic Areas</h1>
      <p className="text-sm text-slate-500 mb-8">
        {schoolAdmin.school.name} — Work Education, Art, Health &amp; Physical Education, Discipline, and similar areas.
        A separate, simpler axis from subject marks — no weights, no marks, just a grade per area.
      </p>

      <CoScholasticConfigClient
        schoolId={schoolId}
        activeSession={activeSession ? { id: activeSession.id, name: activeSession.name } : null}
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        gradingScales={gradingScales.map((s) => ({ id: s.id, name: s.name }))}
        grades={schoolGrades.map((g) => ({
          id: g.id,
          displayName: g.displayName,
          periods: periodsByGrade[g.id] || [],
          setting: settingByGrade[g.id] || null,
        }))}
      />
    </div>
  );
}
