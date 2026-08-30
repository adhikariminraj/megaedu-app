export type AttendanceRow = { date: string; status: string; remarks: string | null };
export type ProgressRow = { subjectName: string; total: number; completed: number; inProgress: number };
export type TestResultRow = {
  id: string;
  testTitle: string;
  unitTitle: string;
  subjectName: string;
  testDate: string;
  maxMarks: number;
  status: string;
  marksObtained: number | null;
  remarks: string | null;
};
export type EvaluationRow = {
  id: string;
  teacherName: string;
  subjectName: string | null; // null = General Student Evaluation; set = Subject Evaluation
  remarks: string;
  createdAt: string;
};
export type SubjectResultRow = {
  gradeSubjectId: string;
  subjectName: string;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  gradeLabel: string | null;
  gradePoint: number | null;
  isComplete: boolean;
};

/**
 * Read-only Phase 3B academic summary — Teaching Progress, Test
 * Results, Recent Attendance. Shared between StudentDashboard (a
 * student's own data) and ParentDashboard (one linked child's data per
 * panel instance) so the two never drift out of sync with each other.
 * Renders nothing for a section with no rows, same as the original
 * inline blocks it was extracted from — a student/child with no data
 * yet (e.g. not yet approved, or no session activity) simply shows no
 * extra sections, no placeholder needed.
 */
export default function AcademicProgressPanel({
  attendance,
  teachingProgress,
  testResults,
  evaluations,
  subjectResults,
  gpa,
}: {
  attendance: AttendanceRow[];
  teachingProgress: ProgressRow[];
  testResults: TestResultRow[];
  evaluations: EvaluationRow[];
  subjectResults?: SubjectResultRow[];
  gpa?: number | null;
}) {
  return (
    <>
      {subjectResults && subjectResults.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Assessment Results</h3>
          <p className="text-xs text-slate-400 mb-4">
            Published subject results for this session.
            {typeof gpa === "number" && ` Unweighted GPA: ${gpa.toFixed(2)}.`}
          </p>
          <div className="space-y-2">
            {subjectResults.map((r) => (
              <div key={r.gradeSubjectId} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <span className="font-medium">{r.subjectName}</span>
                <span className="text-slate-400">
                  {" "}
                  — {r.totalObtained}/{r.totalMax}
                  {r.percentage !== null ? ` (${r.percentage.toFixed(1)}%)` : ""}
                  {r.gradeLabel ? ` — ${r.gradeLabel}` : ""}
                  {r.gradePoint !== null ? ` (${r.gradePoint} GPA)` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {evaluations.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Teacher Evaluations</h3>
          <p className="text-xs text-slate-400 mb-4">
            Qualitative remarks shared by your teachers — general development or subject-specific.
          </p>
          <div className="space-y-2">
            {evaluations.map((ev) => (
              <div key={ev.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <span className="font-medium">{ev.subjectName ?? "General Evaluation"}</span>
                <span className="text-slate-400"> — {ev.teacherName} — {ev.createdAt}</span>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{ev.remarks}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {teachingProgress.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Teaching Progress</h3>
          <p className="text-xs text-slate-400 mb-4">
            How far teachers have progressed through each subject's units/chapters this session.
          </p>
          <div className="space-y-2">
            {teachingProgress.map((p) => (
              <div key={p.subjectName} className="text-sm text-slate-700">
                <span className="font-medium">{p.subjectName}</span>
                <span className="text-slate-400">
                  {" "}
                  — {p.completed} completed, {p.inProgress} in progress, {p.total} total
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {testResults.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Test Results</h3>
          <div className="space-y-2">
            {testResults.map((r) => (
              <div key={r.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <span className="font-medium">{r.subjectName}</span> — {r.unitTitle} — {r.testTitle} ({r.testDate})
                <br />
                <span className="text-slate-400">
                  {r.status === "EVALUATED"
                    ? `${r.marksObtained}/${r.maxMarks}`
                    : r.status === "ABSENT"
                    ? "Absent"
                    : "Pending evaluation"}
                  {r.remarks ? ` — ${r.remarks}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {attendance.length > 0 && (
        <div className="border border-slate-200 rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Recent Attendance</h3>
          <div className="space-y-1">
            {attendance.map((a) => (
              <div key={a.date} className="flex items-center justify-between text-sm text-slate-700">
                <span>{a.date}</span>
                <span className="text-slate-400">
                  {a.status}
                  {a.remarks ? ` — ${a.remarks}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
