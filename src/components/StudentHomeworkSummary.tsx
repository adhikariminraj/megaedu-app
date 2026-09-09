import type { HomeworkHistoryRow } from "@/lib/homework";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  NOT_COMPLETED: "Not Completed",
  EXCUSED: "Excused",
};

function submissionLabel(count: number, late: boolean): string {
  if (count === 0) return "No submission";
  const base = count === 1 ? "1 submission" : `${count} submissions`;
  return late ? `${base} (late)` : base;
}

function reviewLabel(count: number): string {
  return count === 1 ? "1 review" : `${count} reviews`;
}

/**
 * Read-only Homework summary for the Teacher/School-Admin Student
 * Profile page — server-rendered, no client state, no expand/collapse,
 * no API calls, no submission or review editing. Deliberately NOT
 * HomeworkHistoryPanel (the Student/Parent dashboard widget): that
 * component is a client-side workflow surface (submit forms, fetched
 * detail on expand), which would make this academic-record page look
 * like a copy of the Student Dashboard rather than a summary alongside
 * Assessment Results/Teaching Progress/Test Results/Attendance.
 *
 * Takes the exact HomeworkHistoryRow[] shape fetchStudentHomeworkHistory()
 * (src/lib/homework.ts) already returns — no new data shape, no new
 * query. Renders nothing when there's no history, matching
 * AcademicProgressPanel's own "no placeholder needed" convention for
 * every one of its sections.
 */
export default function StudentHomeworkSummary({ rows }: { rows: HomeworkHistoryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl p-5 mb-8">
      <h3 className="font-semibold text-slate-800 mb-1">Homework</h3>
      <p className="text-xs text-slate-400 mb-4">
        Homework applicable to this student — Completion, Submission, and Review status.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.applicabilityId} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
            <span className="font-medium">{r.subjectName}</span> — {r.title}
            {r.isIndividual && <span className="text-slate-400"> [Individual]</span>}
            <br />
            <span className="text-slate-400">
              Due {r.dueDate} · {r.status ? STATUS_LABEL[r.status] : "Not yet recorded"} ·{" "}
              {submissionLabel(r.submissionCount, r.latestAttemptLate)} · {reviewLabel(r.reviewCount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
