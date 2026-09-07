"use client";

import { useState } from "react";
import { addDaysToDateString, mergeAndGroupCalendarItems, type CalendarItem } from "@/lib/calendar";
import type { DayStatus } from "@/lib/schoolCalendar";
import CalendarAnnual from "@/components/CalendarAnnual";
import CalendarAgenda from "@/components/CalendarAgenda";

/** Agenda's own concise window — independent of however wide the Annual
 * view's fetch happens to be. */
const AGENDA_WINDOW_DAYS = 30;

/**
 * Calendar Annual view — Kilometer 1 UI refinement. The one place the
 * [Annual] / [Agenda] toggle lives, reused by every K1 entry point
 * (public /calendar, the school-scoped and self-scoped authenticated
 * pages) — never duplicated per page. Both modes render from the exact
 * same already-authorized `items` array; this component does no
 * fetching, no authorization, and no re-adaptation of its own —
 * CalendarAgenda.tsx is reused completely unmodified for Agenda mode.
 */
export default function CalendarView({
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
  const [mode, setMode] = useState<"annual" | "agenda">("annual");

  return (
    <div>
      <div className="flex gap-1 mb-6 border border-slate-200 rounded-full p-1 w-fit">
        {(["annual", "agenda"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full transition capitalize ${
              mode === m ? "bg-mega-navy text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "annual" ? (
        <CalendarAnnual items={items} monthsWindow={monthsWindow} todayDate={todayDate} dayStatuses={dayStatuses} />
      ) : (
        // Agenda keeps its own concise, upcoming-only contract regardless of
        // how wide the Annual view's shared fetch is — same `items` array,
        // no second query, just a client-side [today, today+30] filter.
        <CalendarAgenda
          groups={mergeAndGroupCalendarItems([
            items.filter((i) => i.date >= todayDate && i.date <= addDaysToDateString(todayDate, AGENDA_WINDOW_DAYS)),
          ])}
          todayDate={todayDate}
        />
      )}
    </div>
  );
}
