import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportCard } from "@/lib/assessmentResults";

export const dynamic = "force-dynamic";

/**
 * A live Report Card view — NOT a persisted snapshot (see
 * buildReportCard() in src/lib/assessmentResults.ts for why). Access:
 * the Student themselves, a Parent linked to this student, or staff
 * (School Admin / any approved Teacher at the student's school — the
 * same Skills-page/Student-Profile precedent, no assignment-level
 * scoping). Audience is resolved from WHICH of those the caller is,
 * then passed straight through to buildReportCard() so a Student/
 * Parent only ever sees published data, exactly as
 * fetchAssessmentResults() already enforces elsewhere.
 */
export default async function ReportCardPage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, userId: true, schoolId: true },
  });
  if (!student || !student.schoolId) notFound();

  let audience: "STUDENT" | "PARENT" | "STAFF" | null = null;
  if (student.userId === userId) {
    audience = "STUDENT";
  } else {
    const [parentLink, schoolAdmin, teacher] = await Promise.all([
      prisma.parentStudent.findFirst({ where: { studentId: student.id, parent: { userId } } }),
      prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: student.schoolId } } }),
      prisma.teacher.findFirst({ where: { userId, schoolId: student.schoolId, approved: true } }),
    ]);
    if (parentLink) audience = "PARENT";
    else if (schoolAdmin || teacher) audience = "STAFF";
  }
  if (!audience) redirect("/dashboard");

  const reportCard = await buildReportCard(student.id, audience);
  if (!reportCard) notFound();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{reportCard.school?.name}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Report Card — {reportCard.student.name}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {reportCard.grade
          ? `${reportCard.grade.displayName}${reportCard.grade.sectionName ? ` — Section ${reportCard.grade.sectionName}` : ""} · ${reportCard.academicSession?.name}`
          : "No current grade placement"}
      </p>

      <div className="border border-slate-200 rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-slate-800 mb-1">Subject Results</h3>
        <p className="text-xs text-slate-400 mb-4">
          {audience === "STAFF" ? "All results, published or draft." : "Published results only."}
          {typeof reportCard.gpa === "number" && ` Unweighted GPA: ${reportCard.gpa.toFixed(2)}.`}
        </p>
        {reportCard.subjects.length === 0 ? (
          <p className="text-sm text-slate-400">No results available yet.</p>
        ) : (
          <div className="space-y-4">
            {reportCard.subjects.map((s) => (
              <div key={s.gradeSubjectId} className="border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">{s.subjectName}</span>
                  {audience === "STAFF" && (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.publicationStatus === "PUBLISHED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.publicationStatus}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {s.subjectTotal.totalObtained}/{s.subjectTotal.totalMax}
                  {s.subjectTotal.percentage !== null ? ` (${s.subjectTotal.percentage.toFixed(1)}%)` : " — incomplete"}
                  {s.grade ? ` — ${s.grade.label}` : ""}
                  {s.grade?.gradePoint !== null && s.grade?.gradePoint !== undefined ? ` (${s.grade.gradePoint} GPA)` : ""}
                </p>
                {s.periods.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {s.periods.map((p) => (
                      <p key={p.periodId} className="text-xs text-slate-500">
                        {p.name}: {p.result.totalObtained}/{p.result.totalMax}
                        {p.result.percentage !== null ? ` (${p.result.percentage.toFixed(1)}%)` : " — incomplete"}
                        {p.grade ? ` — ${p.grade.label}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {reportCard.evaluations.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Teacher Evaluations</h3>
          <div className="space-y-2">
            {reportCard.evaluations.map((ev) => (
              <div key={ev.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <span className="font-medium">{ev.subjectName ?? "General Evaluation"}</span>
                <span className="text-slate-400"> — {ev.teacherName} — {ev.createdAt}</span>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{ev.remarks}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Attendance Summary</h3>
        {reportCard.attendance.length === 0 ? (
          <p className="text-sm text-slate-400">No attendance recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {reportCard.attendance.map((a) => (
              <div key={a.date} className="flex items-center justify-between text-sm text-slate-700">
                <span>{a.date}</span>
                <span className="text-slate-400">
                  {a.status}
                  {a.remarks ? ` — ${a.remarks}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
