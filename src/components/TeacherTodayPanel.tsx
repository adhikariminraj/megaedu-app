import { todayInKathmandu } from "@/lib/homework";
import type { TeacherMeetingRow } from "@/lib/academicProgress";

/**
 * The soonest still-SCHEDULED meeting whose scheduledAt falls on today's
 * Kathmandu calendar date and hasn't happened yet. Mirrors the identical
 * selection rule already verified for Parent's "My Children Today"
 * meeting segment (MyChildrenTodayPanel.tsx) — written independently
 * here rather than shared, since the two callers work over differently
 * shaped rows (a Teacher's meetings carry a student name; a child's
 * meetings don't need one). A meeting that's COMPLETED/CANCELLED, or
 * simply already passed, never qualifies — this never invents an
 * upcoming time out of one that has already occurred.
 */
function nextMeetingToday(meetings: TeacherMeetingRow[], today: string): TeacherMeetingRow | null {
  const now = Date.now();
  const upcomingToday = meetings.filter((m) => {
    if (m.status !== "SCHEDULED") return false;
    const meetingInstant = new Date(m.scheduledAt);
    if (meetingInstant.getTime() <= now) return false;
    const meetingDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(meetingInstant);
    return meetingDay === today;
  });
  if (upcomingToday.length === 0) return null;
  return upcomingToday.reduce((a, b) => (new Date(a.scheduledAt) < new Date(b.scheduledAt) ? a : b));
}

function formatKathmanduTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Teacher Today — Kilometer 1 (meetings only). A pure
 * aggregation/presentation layer over meetings already fetched via
 * fetchMeetingsForTeacher() — no query of its own, no authorization
 * logic of its own. Rendered from both Teacher entry points
 * (TeacherDashboard.tsx for a single-school Teacher,
 * /dashboard/schools/[schoolId]/page.tsx for a multi-school one), each
 * passing only that one school's already-authorized meetings and its
 * own correct meetings-page href.
 *
 * Unlike MyChildrenTodayPanel's "Nothing needs your attention today"
 * fallback, this panel renders NOTHING at all when there's no
 * qualifying meeting — this kilometer has exactly one signal, so an
 * empty shell would just be an empty box, not a useful confirmation.
 */
export default function TeacherTodayPanel({
  meetings,
  meetingsHref,
}: {
  meetings: TeacherMeetingRow[];
  meetingsHref: string;
}) {
  const today = todayInKathmandu();
  const next = nextMeetingToday(meetings, today);
  if (!next) return null;

  return (
    <div className="border border-slate-200 rounded-xl p-5 mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Teacher Today</h2>
      <a href={meetingsHref} className="block text-sm text-slate-700 hover:text-mega-navy transition mt-2">
        🗓️ Next meeting today: {formatKathmanduTime(next.scheduledAt)} — {next.studentName}
      </a>
    </div>
  );
}
