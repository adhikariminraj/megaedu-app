import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";
import { requireSchoolAdmin, requireClassTeacher } from "@/lib/authorize";
import CoScholasticEntryClient from "./CoScholasticEntryClient";

export const dynamic = "force-dynamic";

/**
 * Co-Scholastic entry UI for one grade, this session — deliberately the
 * smaller, simpler sibling of the scholastic marks-entry page: no
 * marks, no weights, no publish step, just a grade label per area per
 * scope (a specific period, or the always-present Annual scope).
 */
export default async function CoScholasticEntryPage({ params }: { params: { schoolGradeId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolGrade = await prisma.schoolGrade.findUnique({ where: { id: params.schoolGradeId } });
  if (!schoolGrade) notFound();
  const schoolId = schoolGrade.schoolId;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) notFound();

  // Never pre-filters the teacher lookup by the Teacher.schoolId/
  // approved bridge fields (which can go stale — see
  // src/lib/affiliation.ts's syncTeacherBridgeFields doc comment, and
  // the identical, explicit reasoning already documented in
  // dashboard/academics/[gradeSubjectId]/page.tsx). requireClassTeacher()
  // is the real gate — it independently re-resolves the caller's own
  // Teacher identity, checks a fresh ACTIVE TeacherSchoolAffiliation at
  // this specific schoolId, and requires a matching
  // ClassTeacherAssignment for THIS session (the original query never
  // filtered by academicSessionId at all — a second, independent fix:
  // a stale historical assignment from a past session could otherwise
  // grant access here too).
  const [adminUserId, classTeacherUserId] = await Promise.all([
    requireSchoolAdmin(schoolId),
    requireClassTeacher(schoolId, { academicSessionId: activeSession.id, schoolGradeId: params.schoolGradeId }),
  ]);
  const isAdmin = !!adminUserId;
  if (!isAdmin && !classTeacherUserId) redirect("/dashboard/co-scholastic");

  const [areas, periods, setting, roster, results] = await Promise.all([
    prisma.coScholasticArea.findMany({ where: { schoolId, isActive: true }, orderBy: { order: "asc" } }),
    prisma.coScholasticPeriod.findMany({
      where: { schoolGradeId: params.schoolGradeId, academicSessionId: activeSession.id },
      orderBy: { order: "asc" },
    }),
    prisma.coScholasticGradeSetting.findUnique({
      where: { schoolGradeId_academicSessionId: { schoolGradeId: params.schoolGradeId, academicSessionId: activeSession.id } },
      include: { gradingScale: { include: { bands: { orderBy: { order: "asc" } } } } },
    }),
    prisma.gradeHistory.findMany({
      where: { schoolGradeId: params.schoolGradeId, academicSessionId: activeSession.id, status: { in: CURRENT_ROSTER_STATUSES } },
      include: { student: true },
      orderBy: { student: { fullName: "asc" } },
    }),
    prisma.coScholasticResult.findMany({
      where: { academicSessionId: activeSession.id, area: { schoolId } },
    }),
  ]);

  if (!setting) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">{schoolGrade.displayName} — Co-Scholastic</h1>
        <p className="text-slate-500 text-sm">
          Not configured yet for this session.{" "}
          {isAdmin && (
            <a href="/dashboard/co-scholastic-config" className="text-mega-blue font-medium">
              Configure →
            </a>
          )}
        </p>
      </div>
    );
  }

  return (
    <CoScholasticEntryClient
      schoolId={schoolId}
      schoolGradeId={params.schoolGradeId}
      academicSessionId={activeSession.id}
      gradeName={schoolGrade.displayName}
      areas={areas.map((a) => ({ id: a.id, name: a.name }))}
      periods={periods.map((p) => ({ id: p.id, name: p.name }))}
      gradeLabels={setting.gradingScale.bands.map((b) => b.label)}
      students={roster.map((r) => ({ studentId: r.studentId, name: r.student.fullName }))}
      results={results
        .filter((r) => roster.some((rr) => rr.studentId === r.studentId))
        .map((r) => ({ areaId: r.areaId, studentId: r.studentId, coScholasticPeriodId: r.coScholasticPeriodId, gradeLabel: r.gradeLabel }))}
    />
  );
}
