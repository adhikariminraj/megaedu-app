export type HomeworkRow = {
  id: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string;
};

/**
 * Read-only "Today's Homework" list — shared by StudentDashboard (their
 * own homework) and ParentDashboard (once per linked child), matching
 * the same "one presentational component, every caller" discipline as
 * AcademicProgressPanel, so the two views can never render this
 * differently. The data itself always comes from
 * fetchTodaysHomework() (src/lib/homework.ts) — this component only
 * displays whatever it's given.
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
