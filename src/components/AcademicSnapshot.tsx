/**
 * Compact "Attendance | Homework Completion | Overall Performance"
 * summary strip for the School Admin Student Profile's identity/header
 * area — an additional summary LAYER, not a replacement for the
 * existing detailed Attendance/Homework/Assessment Results sections
 * further down this same page, which remain exactly as they were.
 *
 * Deliberately three plain numbers, no charts/graphs — every value
 * shows "N/A" (never a manufactured 0%) when its underlying data is
 * absent, matching the null-when-empty convention already established
 * by computeHomeworkRollup()'s own completionPercentage.
 */
export default function AcademicSnapshot({
  attendancePercentage,
  homeworkCompletionPercentage,
  overallPerformance,
}: {
  attendancePercentage: number | null;
  homeworkCompletionPercentage: number | null;
  overallPerformance: { value: number; basis: "GPA" | "PERCENTAGE" } | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 border border-slate-200 rounded-xl p-4 mb-6 text-center">
      <div>
        <p className="text-lg font-semibold text-slate-800">
          {attendancePercentage !== null ? `${attendancePercentage.toFixed(1)}%` : "N/A"}
        </p>
        <p className="text-xs text-slate-400">Attendance</p>
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-800">
          {homeworkCompletionPercentage !== null ? `${homeworkCompletionPercentage.toFixed(0)}%` : "N/A"}
        </p>
        <p className="text-xs text-slate-400">Homework Completion</p>
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-800">
          {overallPerformance
            ? overallPerformance.basis === "GPA"
              ? `${overallPerformance.value.toFixed(2)} GPA`
              : `${overallPerformance.value.toFixed(1)}%`
            : "N/A"}
        </p>
        <p className="text-xs text-slate-400">Overall Performance</p>
      </div>
    </div>
  );
}
