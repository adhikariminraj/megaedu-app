export type HomeworkRow = {
  id: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string;
  status: "COMPLETED" | "PARTIAL" | "NOT_COMPLETED" | "EXCUSED" | null;
  submissionCount: number;
  latestAttemptLate: boolean;
  reviewCount: number;
};

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
 * Read-only "Today's Homework" list — shared by StudentDashboard (their
 * own homework) and ParentDashboard (once per linked child), matching
 * the same "one presentational component, every caller" discipline as
 * AcademicProgressPanel, so the two views can never render this
 * differently. The data itself always comes from
 * fetchTodaysHomework() (src/lib/homework.ts) — this component only
 * displays whatever it's given.
 *
 * A concise, status-AWARE summary — due date/Completion/Submission/
 * Review, same plain-text convention as StudentHomeworkSummary — but
 * deliberately not a second workspace: no Submit control, no
 * submission/review detail. That workflow remains My Homework's
 * (HomeworkHistoryPanel) alone.
 */
export default function TodaysHomeworkPanel({ homework }: { homework: HomeworkRow[] }) {
  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Today's Homework</h3>
      {homework.length === 0 ? (
        <p className="text-sm text-slate-400">No homework due today.</p>
      ) : (
        <div className="space-y-3 mt-3">
          {homework.map((hw) => (
            <div key={hw.id} className="border border-slate-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-mega-navy">{hw.subjectName}</p>
              <p className="font-medium text-slate-800 text-sm">{hw.title}</p>
              <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{hw.instructions}</p>
              <p className="text-xs text-slate-400 mt-1">
                Due {hw.dueDate} · {hw.status ? STATUS_LABEL[hw.status] : "Not yet recorded"} ·{" "}
                {submissionLabel(hw.submissionCount, hw.latestAttemptLate)} · {reviewLabel(hw.reviewCount)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
