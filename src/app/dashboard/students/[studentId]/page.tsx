import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AcademicProgressPanel from "@/components/AcademicProgressPanel";
import { fetchAcademicProgress, fetchMeetingsForStudent } from "@/lib/academicProgress";
import { fetchAssessmentResults, toSubjectResultRows } from "@/lib/assessmentResults";

export const dynamic = "force-dynamic";

/**
 * Comprehensive, read-only Student Profile for School Admin / Teacher
 * staff use — aggregates Attendance, Teaching Progress, Unit Test
 * results, and Qualitative Evaluations (via the same
 * fetchAcademicProgress() the Student/Parent dashboards already use,
 * called here with audience: "STAFF" so evaluation visibility isn't
 * filtered) plus Parent-Teacher Meeting history (via
 * fetchMeetingsForStudent(), audience: "STAFF", rendered locally here —
 * deliberately NOT through the shared AcademicProgressPanel, so that
 * component still structurally never carries meeting data anywhere a
 * Student's own render path could reach it).
 *
 * Access mirrors the existing Skills precedent exactly
 * (students/[studentId]/skills/route.ts): any School Admin of this
 * student's school, or any approved Teacher at that school — no
 * per-assignment scoping in this phase, consistent with how Skill
 * management already works school-wide. This is a read-only page; all
 * actions link out to the existing write surfaces rather than
 * duplicating their forms.
 */
export default async function StudentProfilePage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: {
      user: true,
      school: true,
      gradeHistory: {
        include: { schoolGrade: true, section: true, academicSession: true },
        orderBy: { academicSession: { startDate: "desc" } },
        take: 1,
        where: { academicSession: { status: "ACTIVE" } },
      },
    },
  });
  if (!student || !student.schoolId) notFound();

  const [schoolAdmin, teacher] = await Promise.all([
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: student.schoolId } } }),
    prisma.teacher.findFirst({ where: { userId, schoolId: student.schoolId, approved: true } }),
  ]);
  if (!schoolAdmin && !teacher) redirect("/dashboard");

  const [progress, meetings, assessment] = await Promise.all([
    fetchAcademicProgress(student.id, "STAFF"),
    fetchMeetingsForStudent(student.id, "STAFF"),
    fetchAssessmentResults(student.id, "STAFF"),
  ]);

  const placement = student.gradeHistory[0];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{student.school?.name}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{student.user.name}</h1>
      <p className="text-sm text-slate-500 mb-1">{student.user.email}</p>
      <p className="text-sm text-slate-500 mb-6">
        {placement
          ? `${placement.schoolGrade.displayName}${placement.section ? ` — Section ${placement.section.name}` : ""} · ${placement.academicSession.name}`
          : student.gradeLevel || "No current grade placement"}
        {" · "}
        <span className={student.approved ? "text-mega-green" : "text-amber-600"}>
          {student.approved ? "Approved" : "Pending School Approval"}
        </span>
      </p>

      <div className="flex flex-wrap gap-3 text-xs mb-8">
        <Link href="/dashboard/evaluations" className="text-mega-blue font-medium">
          Manage general evaluation →
        </Link>
        <Link href="/dashboard/attendance" className="text-mega-blue font-medium">
          Manage attendance →
        </Link>
        <Link href="/dashboard/meetings" className="text-mega-blue font-medium">
          Manage meetings →
        </Link>
      </div>

      <AcademicProgressPanel
        attendance={progress.attendance}
        teachingProgress={progress.teachingProgress}
        testResults={progress.testResults}
        evaluations={progress.evaluations}
        subjectResults={toSubjectResultRows(assessment.subjects)}
        gpa={assessment.gpa}
      />

      {progress.attendance.length === 0 &&
        progress.teachingProgress.length === 0 &&
        progress.testResults.length === 0 &&
        progress.evaluations.length === 0 &&
        assessment.subjects.length === 0 && (
          <p className="text-slate-400 text-sm mb-8">No academic activity recorded yet this session.</p>
        )}

      <p className="text-xs mb-8">
        <Link href={`/dashboard/report-card/${student.id}`} className="text-mega-blue font-medium">
          View full Report Card →
        </Link>
      </p>

      <div className="border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Parent-Teacher Meetings</h3>
        {meetings.length === 0 ? (
          <p className="text-sm text-slate-400">None scheduled.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {m.subjectName ?? "General"} — {m.teacherName}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      m.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : m.status === "CANCELLED"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  {new Date(m.scheduledAt).toLocaleString()}
                  {m.location ? ` — ${m.location}` : ""}
                </p>
                {m.status === "COMPLETED" && m.outcomeNotes && (
                  <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.outcomeNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
