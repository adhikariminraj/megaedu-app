import type { CalendarItem } from "@/lib/calendar";

const CATEGORY_ICON: Record<CalendarItem["category"], string> = {
  GENERAL: "🇳🇵",
  SCHOOL_EVENT: "🏫",
  MEETING: "🗓️",
  HOMEWORK: "📚",
  ACADEMIC_PERIOD: "📅",
  SCHOOL_ACTIVITY: "📋",
};

const SCHOOL_ACTIVITY_ICON: Record<string, string> = {
  VACATION: "🏖️",
  EXAMINATION: "📝",
  SPECIAL_CLOSURE: "🚫",
  PTM: "👪",
  RESULT_DAY: "📊",
  REPORT_CARD_DISTRIBUTION: "📄",
};

function itemIcon(item: CalendarItem): string {
  if (item.category === "SCHOOL_ACTIVITY" && item.subType && SCHOOL_ACTIVITY_ICON[item.subType]) {
    return SCHOOL_ACTIVITY_ICON[item.subType];
  }
  return CATEGORY_ICON[item.category];
}

function formatGroupHeading(dateStr: string, todayStr: string): string {
  const isToday = dateStr === todayStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return isToday ? `Today — ${label}` : label;
}

/**
 * Calendar K1 — the one shared presentational Agenda list, rendered
 * from every K1 entry point (public /calendar, the school-scoped and
 * self-scoped authenticated pages). Receives already-authorized,
 * already-merged, already-grouped CalendarItem groups — this component
 * does no fetching, no authorization, and no further filtering of its
 * own. Deliberately a flat chronological list, never a grid — see
 * docs/CALENDAR.md for why Month/Week/Day views are out of scope for
 * this kilometer.
 */
export default function CalendarAgenda({
  groups,
  todayDate,
}: {
  groups: { date: string; items: CalendarItem[] }[];
  todayDate: string;
}) {
  if (groups.length === 0) {
    return <p className="text-slate-400 text-sm">Nothing coming up.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {formatGroupHeading(group.date, todayDate)}
          </h3>
          <div className="space-y-2">
            {group.items.map((item) => {
              const inner = (
                <>
                  <span className="mr-2">{itemIcon(item)}</span>
                  <span className="font-medium text-slate-800">{item.title}</span>
                  {!item.isAllDay && item.time && <span className="text-slate-400"> — {item.time}</span>}
                  {item.location && <span className="text-slate-400"> — {item.location}</span>}
                  {item.description && <p className="text-sm text-slate-500 mt-1 ml-6">{item.description}</p>}
                </>
              );
              return item.link ? (
                <a
                  key={item.id}
                  href={item.link}
                  className="block text-sm border border-slate-100 rounded-lg px-3 py-2 hover:border-mega-navy transition"
                >
                  {inner}
                </a>
              ) : (
                <div key={item.id} className="text-sm border border-slate-100 rounded-lg px-3 py-2">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
