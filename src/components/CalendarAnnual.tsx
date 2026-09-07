import type { CalendarItem } from "@/lib/calendar";
import { addDaysToDateString } from "@/lib/calendar";
import { buildMonthGrid, monthLabel } from "@/lib/monthGrid";
import type { DayStatus } from "@/lib/schoolCalendar";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Calendar K1.2 — distinct color FAMILIES (not just different shades of
// the same neutral), so the four non-regular statuses read apart from
// each other at a glance in a dense annual grid: blue (Public Holiday),
// green (Vacation), amber (Examination), gray (Weekly Holiday). Regular
// intentionally has no entry — it stays visually silent (no background)
// so the exceptions are what draw the eye.
const DAY_STATUS_BG: Record<DayStatus, string> = {
  SPECIAL_CLOSURE: "bg-rose-100",
  EXAMINATION: "bg-amber-200",
  VACATION: "bg-emerald-100",
  PUBLIC_HOLIDAY: "bg-blue-100",
  WEEKLY_HOLIDAY: "bg-slate-100",
};

const DAY_STATUS_LEGEND: { status: DayStatus; label: string }[] = [
  { status: "PUBLIC_HOLIDAY", label: "Public Holiday" },
  { status: "VACATION", label: "Vacation" },
  { status: "EXAMINATION", label: "Examination" },
  { status: "WEEKLY_HOLIDAY", label: "Weekly Holiday" },
];

/**
 * Calendar Annual view — Kilometer 1 UI refinement, extended in K1.1
 * with the Day Status background layer. Receives already-authorized,
 * already-projected CalendarItem[] (activities: General, School
 * Events, Meetings, Homework, Academic Session, SchoolCalendarEntry)
 * PLUS an independently-resolved `dayStatuses` map (from
 * resolveDayStatuses(), src/lib/schoolCalendar.ts) and renders 12 month
 * cards. Does no fetching, no authorization, no further filtering of
 * its own — same contract as CalendarAgenda.tsx.
 *
 * Day Status and Activities are deliberately two separate visual
 * layers, never merged: dayStatuses controls only the cell background;
 * the existing per-item number/dot treatment below is unchanged and
 * keeps rendering on top of whatever the background is. See
 * docs/CALENDAR.md "Day Status vs Activities".
 */
export default function CalendarAnnual({
  items,
  monthsWindow,
  todayDate,
  dayStatuses,
}: {
  items: CalendarItem[];
  monthsWindow: { year: number; month: number }[];
  todayDate: string;
  dayStatuses?: Record<string, DayStatus>;
}) {
  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date);
    if (list) list.push(item);
    else itemsByDate.set(item.date, [item]);
  }

  const hasAnyStatus = !!dayStatuses && Object.keys(dayStatuses).length > 0;

  return (
    <div>
      {hasAnyStatus && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 text-xs text-slate-600">
          {DAY_STATUS_LEGEND.map(({ status, label }) => (
            <span key={status} className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full ${DAY_STATUS_BG[status]} border border-black/5`} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {monthsWindow.map(({ year, month }) => (
          <MonthCard
            key={`${year}-${month}`}
            year={year}
            month={month}
            itemsByDate={itemsByDate}
            todayDate={todayDate}
            dayStatuses={dayStatuses}
          />
        ))}
      </div>
    </div>
  );
}

function dayTreatment(dayItems: CalendarItem[] | undefined): {
  numberClass: string;
  dots: string[];
} {
  if (!dayItems || dayItems.length === 0) return { numberClass: "text-slate-600", dots: [] };

  const hasNationalHoliday = dayItems.some((i) => i.category === "GENERAL" && i.subType === "NATIONAL_HOLIDAY");
  const hasObservance = dayItems.some((i) => i.category === "GENERAL" && i.subType !== "NATIONAL_HOLIDAY");
  const hasSchoolEvent = dayItems.some((i) => i.category === "SCHOOL_EVENT");
  const hasMeeting = dayItems.some((i) => i.category === "MEETING");
  const hasHomework = dayItems.some((i) => i.category === "HOMEWORK");
  const hasAcademicPeriod = dayItems.some((i) => i.category === "ACADEMIC_PERIOD");
  const hasPtm = dayItems.some((i) => i.category === "SCHOOL_ACTIVITY" && i.subType === "PTM");
  const hasResultOrReportCard = dayItems.some(
    (i) => i.category === "SCHOOL_ACTIVITY" && (i.subType === "RESULT_DAY" || i.subType === "REPORT_CARD_DISTRIBUTION")
  );

  // Restrained, single-treatment priority for the day number itself —
  // national holiday first (the one thing a user should never miss),
  // then school event, then observance. Minor categories (meeting,
  // homework, academic period, PTM, result/report card) never fight for
  // the number's own color; they only ever show as a small dot
  // underneath. VACATION/EXAMINATION/SPECIAL_CLOSURE never appear here
  // at all — those are communicated by the Day Status background
  // instead, not by the number.
  let numberClass = "text-slate-600";
  if (hasNationalHoliday) numberClass = "bg-mega-navy text-white font-semibold rounded-full";
  else if (hasSchoolEvent) numberClass = "ring-1 ring-mega-blue text-mega-navy font-medium rounded-full";
  else if (hasObservance) numberClass = "text-mega-blue font-medium";

  const dots: string[] = [];
  if (hasMeeting) dots.push("bg-slate-400");
  if (hasHomework) dots.push("bg-amber-500");
  if (hasAcademicPeriod) dots.push("bg-slate-300");
  if (hasPtm) dots.push("bg-purple-400");
  if (hasResultOrReportCard) dots.push("bg-emerald-500");

  return { numberClass, dots };
}

/**
 * Background classes for one day cell, including rounding only at the
 * boundaries of a continuous run of the same status — so a multi-day
 * Vacation/Examination reads as one continuous band rather than a row
 * of isolated boxes, computed purely from neighboring dates in the
 * already-resolved map (no separate range metadata needed).
 */
function dayStatusBgClass(dateStr: string, dayStatuses: Record<string, DayStatus> | undefined): string {
  if (!dayStatuses) return "";
  const status = dayStatuses[dateStr];
  if (!status) return "";

  const prevSame = dayStatuses[addDaysToDateString(dateStr, -1)] === status;
  const nextSame = dayStatuses[addDaysToDateString(dateStr, 1)] === status;

  let rounding = "rounded-md";
  if (prevSame && nextSame) rounding = "";
  else if (prevSame) rounding = "rounded-r-md";
  else if (nextSame) rounding = "rounded-l-md";

  return `${DAY_STATUS_BG[status]} ${rounding}`;
}

function MonthCard({
  year,
  month,
  itemsByDate,
  todayDate,
  dayStatuses,
}: {
  year: number;
  month: number;
  itemsByDate: Map<string, CalendarItem[]>;
  todayDate: string;
  dayStatuses?: Record<string, DayStatus>;
}) {
  const weeks = buildMonthGrid(year, month);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const monthDates = [...itemsByDate.keys()].filter((d) => d.startsWith(monthPrefix)).sort();

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{monthLabel(year, month)}</h3>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-slate-400 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i}>{w}</div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-y-1 text-center">
            {week.map((dateStr, di) => {
              if (!dateStr) return <div key={di} />;
              const dayItems = itemsByDate.get(dateStr);
              const { numberClass, dots } = dayTreatment(dayItems);
              const isToday = dateStr === todayDate;
              const dayNum = Number(dateStr.slice(-2));
              const bgClass = dayStatusBgClass(dateStr, dayStatuses);
              return (
                <div key={di} className={`flex flex-col items-center gap-0.5 py-0.5 ${bgClass}`}>
                  <span
                    className={`w-6 h-6 flex items-center justify-center text-[11px] ${numberClass} ${
                      isToday ? "outline outline-1 outline-mega-red" : ""
                    }`}
                  >
                    {dayNum}
                  </span>
                  <span className="flex gap-0.5 h-1">
                    {dots.map((c, i) => (
                      <span key={i} className={`w-1 h-1 rounded-full ${c}`} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
        {monthDates.length === 0 ? (
          <p className="text-[11px] text-slate-300">No items this month.</p>
        ) : (
          monthDates.flatMap((dateStr) =>
            (itemsByDate.get(dateStr) ?? []).map((item) => {
              const row = (
                <>
                  <span className="text-slate-400 tabular-nums">{dateStr.slice(-2)}</span>{" "}
                  <span className="text-slate-700">{item.title}</span>
                  {item.description && item.category === "SCHOOL_ACTIVITY" && (
                    <span className="text-slate-400"> · {item.description}</span>
                  )}
                </>
              );
              return item.link ? (
                <a key={item.id} href={item.link} className="block text-[11px] hover:underline">
                  {row}
                </a>
              ) : (
                <p key={item.id} className="text-[11px]">
                  {row}
                </p>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
