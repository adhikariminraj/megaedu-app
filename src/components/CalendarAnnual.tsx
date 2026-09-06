import type { CalendarItem } from "@/lib/calendar";
import { buildMonthGrid, monthLabel } from "@/lib/monthGrid";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Calendar Annual view — Kilometer 1 UI refinement. Receives already-
 * authorized, already-projected CalendarItem[] (from any source
 * adapter combination — General, School Events, Meetings, Homework,
 * Academic Session) and renders 12 month cards. Does no fetching, no
 * authorization, no further filtering of its own — same contract as
 * CalendarAgenda.tsx, which this component sits alongside rather than
 * replaces.
 */
export default function CalendarAnnual({
  items,
  monthsWindow,
  todayDate,
}: {
  items: CalendarItem[];
  monthsWindow: { year: number; month: number }[];
  todayDate: string;
}) {
  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date);
    if (list) list.push(item);
    else itemsByDate.set(item.date, [item]);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {monthsWindow.map(({ year, month }) => (
        <MonthCard
          key={`${year}-${month}`}
          year={year}
          month={month}
          itemsByDate={itemsByDate}
          todayDate={todayDate}
        />
      ))}
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

  // Restrained, single-treatment priority for the day number itself —
  // national holiday first (the one thing a user should never miss),
  // then school event, then observance. Minor categories (meeting,
  // homework, academic period) never fight for the number's own color;
  // they only ever show as a small dot underneath.
  let numberClass = "text-slate-600";
  if (hasNationalHoliday) numberClass = "bg-mega-navy text-white font-semibold rounded-full";
  else if (hasSchoolEvent) numberClass = "ring-1 ring-mega-blue text-mega-navy font-medium rounded-full";
  else if (hasObservance) numberClass = "text-mega-blue font-medium";

  const dots: string[] = [];
  if (hasMeeting) dots.push("bg-slate-400");
  if (hasHomework) dots.push("bg-amber-500");
  if (hasAcademicPeriod) dots.push("bg-slate-300");

  return { numberClass, dots };
}

function MonthCard({
  year,
  month,
  itemsByDate,
  todayDate,
}: {
  year: number;
  month: number;
  itemsByDate: Map<string, CalendarItem[]>;
  todayDate: string;
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
              return (
                <div key={di} className="flex flex-col items-center gap-0.5">
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
