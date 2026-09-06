import { todayInKathmandu } from "@/lib/homework";
import type { HomeworkRow } from "@/components/TodaysHomeworkPanel";
import type { AttendanceRow } from "@/components/AcademicProgressPanel";
import type { MeetingRow } from "@/lib/academicProgress";

export type ChildTodayInput = {
  name: string;
  todaysHomework: HomeworkRow[];
  attendance: AttendanceRow[];
  meetings: MeetingRow[];
};

// "PRESENT" -> "Present", "EXCUSED" -> "Excused" — a display transform of
// the existing status vocabulary (AcademicProgressPanel shows it raw),
// never a new status category.
function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * The soonest still-SCHEDULED meeting whose scheduledAt falls on today's
 * Kathmandu calendar date and hasn't happened yet. A meeting already
 * COMPLETED/CANCELLED, or one whose time has simply passed, never
 * qualifies as "next" — this deliberately never invents an upcoming time
 * out of a meeting that has already occurred.
 */
function nextMeetingTime(meetings: MeetingRow[], today: string): string | null {
  const now = Date.now();
  const upcomingToday = meetings.filter((m) => {
    if (m.status !== "SCHEDULED") return false;
    const meetingInstant = new Date(m.scheduledAt);
    if (meetingInstant.getTime() <= now) return false;
    const meetingDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(meetingInstant);
    return meetingDay === today;
  });
  if (upcomingToday.length === 0) return null;
  const soonest = upcomingToday.reduce((a, b) => (new Date(a.scheduledAt) < new Date(b.scheduledAt) ? a : b));
  // Explicit Kathmandu anchor, not the server process's own local
  // timezone — this must render correctly regardless of what OS/region
  // the app happens to be deployed on.
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(soonest.scheduledAt));
}

/**
 * "My Children Today" — a pure aggregation/presentation layer over data
 * the Parent dashboard already fetched (todaysHomework, progress.attendance,
 * meetings, all per child). No query of its own, no authorization logic
 * of its own — every child here already came from the caller's own
 * verified ParentStudent rows, exactly like TodaysHomeworkPanel and
 * AcademicProgressPanel. Renders one calm summary row per child, linking
 * to that child's existing full card via a plain anchor (#child-N) —
 * no route change, no client-side state.
 */
export default function MyChildrenTodayPanel({ entries }: { entries: ChildTodayInput[] }) {
  const today = todayInKathmandu();

  const rows = entries.map((c) => {
    const todaysAttendance = c.attendance.find((a) => a.date === today) ?? null;
    const meetingTime = nextMeetingTime(c.meetings, today);
    const homeworkCount = c.todaysHomework.length;
    return {
      name: c.name,
      homeworkCount,
      todaysAttendance,
      meetingTime,
      isEmpty: homeworkCount === 0 && !todaysAttendance && !meetingTime,
    };
  });

  const allEmpty = rows.every((r) => r.isEmpty);

  return (
    <div className="border border-slate-200 rounded-xl p-5 mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">My Children Today</h2>

      {allEmpty ? (
        <p className="text-sm text-slate-400 mt-2">Nothing needs your attention today.</p>
      ) : (
        <div className="space-y-2 mt-3">
          {rows.map((r, i) => {
            const segments: string[] = [];
            segments.push(r.homeworkCount > 0 ? `📚 ${r.homeworkCount} homework due` : "No homework due today");
            segments.push(
              r.todaysAttendance
                ? r.todaysAttendance.status === "PRESENT"
                  ? "✅ Present today"
                  : `${statusLabel(r.todaysAttendance.status)} today`
                : "❔ Attendance not yet recorded"
            );
            if (r.meetingTime) segments.push(`🗓️ Next meeting ${r.meetingTime}`);

            return (
              <a
                key={i}
                href={`#child-${i}`}
                className="block text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2 hover:border-mega-navy transition"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-slate-400"> · {segments.join(" · ")}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
