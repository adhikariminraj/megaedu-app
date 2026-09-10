import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportCard } from "@/lib/assessmentResults";
import { verifySchoolAccess } from "@/lib/institutionalContext";

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
    // Staff access never resolved from the Teacher.schoolId/approved
    // bridge fields, which can go stale (see src/lib/affiliation.ts's
    // syncTeacherBridgeFields doc comment) — verifySchoolAccess() re-
    // checks a fresh ACTIVE TeacherSchoolAffiliation (or a real
    // SchoolAdmin link) against this student's own current school.
    const [parentLink, access] = await Promise.all([
      prisma.parentStudent.findFirst({
        where: { studentId: student.id, parent: { userId }, confirmedAt: { not: null } },
      }),
      verifySchoolAccess(userId, student.schoolId),
    ]);
    if (parentLink) audience = "PARENT";
    else if (access) audience = "STAFF";
  }
  if (!audience) redirect("/dashboard");

  const reportCard = await buildReportCard(student.id, audience);
  if (!reportCard) notFound();

  // Term-side-by-side layout: the union of every distinct period name
  // across subjects, in first-seen order — different subjects may use
  // different frameworks with different period sets, so a subject with
  // no entry for a given column simply shows "—", never a guessed value.
  const periodNames: string[] = [];
  for (const s of reportCard.subjects) {
    for (const p of s.periods) if (!periodNames.includes(p.name)) periodNames.push(p.name);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-sm text-slate-400 mb-1">{reportCard.school?.name}</p>
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Report Card — {reportCard.student.name}</h1>
        </div>
        {reportCard.student.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reportCard.student.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
        )}
      </div>
      <p className="text-sm text-slate-500 mb-1">
        {reportCard.grade
          ? `${reportCard.grade.displayName}${reportCard.grade.sectionName ? ` — Section ${reportCard.grade.sectionName}` : ""} · ${reportCard.academicSession?.name}`
          : "No current grade placement"}
      </p>
      {(reportCard.parentNames.father || reportCard.parentNames.mother) && (
        <p className="text-xs text-slate-400 mb-1">
          {reportCard.parentNames.father && `Father: ${reportCard.parentNames.father}`}
          {reportCard.parentNames.father && reportCard.parentNames.mother && " · "}
          {reportCard.parentNames.mother && `Mother: ${reportCard.parentNames.mother}`}
        </p>
      )}
      <p className="text-xs text-slate-400 mb-8">
        This is a live, always-current view. For the formal, officially issued annual result, see{" "}
        <Link href={`/dashboard/mark-sheet/${reportCard.student.id}`} className="text-mega-blue font-medium">
          Mark Sheets →
        </Link>
      </p>

      <div className="border border-slate-200 rounded-xl p-5 mb-8 overflow-x-auto">
        <h3 className="font-semibold text-slate-800 mb-1">Subject Results</h3>
        <p className="text-xs text-slate-400 mb-4">
          {audience === "STAFF" ? "All results, published or draft." : "Published results only."}
          {typeof reportCard.gpa === "number" && ` Unweighted GPA: ${reportCard.gpa.toFixed(2)}.`}
        </p>
        {reportCard.subjects.length === 0 ? (
          <p className="text-sm text-slate-400">No results available yet.</p>
        ) : periodNames.length > 0 ? (
          <table className="w-full text-sm border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b-2 border-slate-800 text-left text-xs text-slate-500">
                <th className="py-1.5">Subject</th>
                {periodNames.map((name) => (
                  <th key={name} className="py-1.5 text-right">
                    {name}
                  </th>
                ))}
                <th className="py-1.5 text-right">Total</th>
                <th className="py-1.5 text-right">Grade</th>
              </tr>
            </thead>
            <tbody>
              {reportCard.subjects.map((s) => (
                <tr key={s.gradeSubjectId} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {s.subjectName}
                    {audience === "STAFF" && s.publicationStatus !== "PUBLISHED" && (
                      <span className="ml-1 text-xs font-semibold text-amber-600">(DRAFT)</span>
                    )}
                  </td>
                  {periodNames.map((name) => {
                    const p = s.periods.find((pp) => pp.name === name);
                    return (
                      <td key={name} className="py-1.5 text-right text-slate-600">
                        {p ? (p.result.percentage !== null ? `${p.result.percentage.toFixed(1)}%` : "—") : "—"}
                      </td>
                    );
                  })}
                  <td className="py-1.5 text-right">
                    {s.subjectTotal.percentage !== null ? `${s.subjectTotal.percentage.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-1.5 text-right font-medium">{s.grade?.label ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-2">
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
              </div>
            ))}
          </div>
        )}
      </div>

      {reportCard.coScholastic.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-3">Co-Scholastic Areas</h3>
          <div className="space-y-1">
            {reportCard.coScholastic.map((c) => (
              <div key={c.areaId} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{c.areaName}</span>
                <span className="text-slate-500">
                  {c.periodGrades.length > 0
                    ? c.periodGrades.map((p) => `${p.periodName}: ${p.gradeLabel ?? "—"}`).join(" · ")
                    : c.annualGradeLabel ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportCard.gradingScales.length > 0 && (
        <details className="border border-slate-200 rounded-xl p-5 mb-8">
          <summary className="font-semibold text-slate-800 cursor-pointer">Grading Criteria</summary>
          {reportCard.gradingScales.map((scale) => (
            <div key={scale.name} className="mt-3">
              <p className="text-xs text-slate-500 mb-1">{scale.name}</p>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {scale.bands.map((b) => (
                    <tr key={b.label} className="border-b border-slate-100">
                      <td className="py-1 text-slate-500">
                        {b.minPercent}–{b.maxPercent}
                      </td>
                      <td className="py-1 font-medium">{b.label}</td>
                      {b.gradePoint !== null && <td className="py-1 text-slate-500">{b.gradePoint}</td>}
                      {b.description && <td className="py-1 text-slate-500">{b.description}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </details>
      )}

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
