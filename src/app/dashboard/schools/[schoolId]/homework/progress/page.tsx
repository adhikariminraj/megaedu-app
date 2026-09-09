import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import { fetchClassTeacherHomeworkProgress, fetchIndividualHomeworkProgress } from "@/lib/homeworkRollup";

export const dynamic = "force-dynamic";

/**
 * K5 — Class Teacher / Grade Coordinator read-only Homework progress
 * view. Teacher-only (School Admin redirected, same boundary as the K2
 * completion page) — a school-wide Admin rollup was explicitly deferred
 * in the approved K3-K6 plan to avoid an unbounded, unfiltered query;
 * this page stays naturally bounded to whichever grade(s)/section(s)
 * the caller actually holds a ClassTeacherAssignment for this session.
 * Pure read — no mutation exists on this page at all.
 */
export default async function HomeworkProgressPage({ params }: { params: { schoolId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access || access.role !== "TEACHER") redirect(`/dashboard/schools/${params.schoolId}/homework`);

  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.schoolId, status: "ACTIVE" },
  });
  if (!activeSession) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Homework Progress</h1>
        <p className="text-slate-500 text-sm">No active academic session yet.</p>
      </div>
    );
  }

  const assignments = await prisma.classTeacherAssignment.findMany({
    where: { teacherId: access.teacherId, academicSessionId: activeSession.id },
    include: { schoolGrade: true, section: true },
    orderBy: [{ schoolGrade: { gradeReference: { order: "asc" } } }],
  });

  const groups = await Promise.all(
    assignments.map(async (a) => ({
      label: `${a.schoolGrade.displayName}${a.section ? ` — Section ${a.section.name}` : " — Whole Grade (Grade Coordinator)"}`,
      regular: await fetchClassTeacherHomeworkProgress(a.schoolGradeId, activeSession.id, a.sectionId),
      individual: await fetchIndividualHomeworkProgress(a.schoolGradeId, activeSession.id, a.sectionId),
    }))
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Homework Progress</h1>

      {groups.length === 0 && (
        <p className="text-slate-400 text-sm">
          You are not currently a Class Teacher or Grade Coordinator for any grade/section this session.
        </p>
      )}

      {groups.map((g, i) => (
        <div key={i} className="mb-10">
          <h2 className="font-semibold text-slate-800 mb-3">{g.label}</h2>

          {g.regular.length === 0 && g.individual.length === 0 ? (
            <p className="text-slate-400 text-sm">No published homework yet.</p>
          ) : (
            <>
              {g.regular.length > 0 && (
                <div className="space-y-2 mb-4">
                  {g.regular.map((hw) => (
                    <div key={hw.homeworkId} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{hw.title}</p>
                          <p className="text-xs text-slate-500">
                            {hw.subjectName} {hw.sectionName ? `· Section ${hw.sectionName}` : "· Whole Grade"} · Due {hw.dueDate}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-mega-navy">
                          {hw.rollup.completionPercentage === null ? "N/A" : `${Math.round(hw.rollup.completionPercentage)}%`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        {hw.rollup.assigned} assigned · {hw.rollup.completed} completed · {hw.rollup.partial} partial ·{" "}
                        {hw.rollup.notCompleted} not completed · {hw.rollup.excused} excused · {hw.rollup.unrecorded} unrecorded
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {g.individual.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Individual Homework</h3>
                  <div className="space-y-2">
                    {g.individual.map((hw) => (
                      <div key={hw.homeworkId} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-sm text-slate-800">
                            {hw.title} —{" "}
                            <Link href={`/dashboard/students/${hw.targetStudentId}`} className="hover:underline">
                              {hw.targetStudentName}
                            </Link>
                          </p>
                          <p className="text-xs text-slate-400">
                            {hw.subjectName} · Due {hw.dueDate}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{hw.status ?? "Not yet recorded"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
