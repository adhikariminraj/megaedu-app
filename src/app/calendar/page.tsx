import { prisma } from "@/lib/prisma";
import { todayInKathmandu } from "@/lib/homework";
import { addDaysToDateString, fetchGeneralCalendarItems } from "@/lib/calendar";
import { getAnnualMonths, monthLabel, startOfMonth } from "@/lib/monthGrid";
import { fetchSchoolEventItems } from "@/lib/events";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

/**
 * Calendar K1 — public entry point: General Calendar + public School
 * Events, never Homework/Meetings/any authenticated data. Fixed here,
 * as part of this kilometer, not left as-is:
 *
 * - Timezone: previously used raw `new Date()`/`toLocaleDateString()`,
 *   both process-locale-dependent. Now uses todayInKathmandu() and the
 *   same explicit Kathmandu formatting every other K1 surface uses.
 * - Scale: previously ran `prisma.event.findMany({ take: 50 })` with no
 *   schoolId filter at all — at scale, a handful of active schools
 *   would permanently starve every other school out of the list. Fixed
 *   by never running a cross-school query: institutional Events only
 *   ever appear after a specific school is chosen (plain server-
 *   rendered search-and-pick, no client component, no new API route),
 *   at which point the query is bounded to that one school and a
 *   12-month window — General Calendar is safe to show unconditionally
 *   since that table is small and genuinely shared network-wide.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { q?: string; school?: string };
}) {
  const today = todayInKathmandu();
  const from = startOfMonth(today);
  const to = addDaysToDateString(from, 365);
  const monthsWindow = getAnnualMonths(today);
  const rangeLabel = `${monthLabel(monthsWindow[0].year, monthsWindow[0].month)} – ${monthLabel(
    monthsWindow[11].year,
    monthsWindow[11].month
  )}`;
  const generalItems = await fetchGeneralCalendarItems({ from, to });

  const q = searchParams.q?.trim() || "";
  const selectedSchoolId = searchParams.school?.trim() || "";

  const searchResults = q
    ? await prisma.school.findMany({
        where: { verified: true, isActive: true, name: { contains: q } },
        select: { id: true, name: true, location: true },
        orderBy: { name: "asc" },
        take: 20,
      })
    : [];

  const selectedSchool = selectedSchoolId
    ? await prisma.school.findFirst({
        where: { id: selectedSchoolId, verified: true, isActive: true },
        select: { id: true, name: true },
      })
    : null;

  const schoolEventItems = selectedSchool ? await fetchSchoolEventItems(selectedSchool.id, { from, to }) : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Calendar</h1>
      <p className="text-slate-500 mb-1">Nepal holidays and observances, plus events from verified schools.</p>
      <p className="text-slate-400 text-sm mb-10">{rangeLabel}</p>

      <div className="mb-12">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">General Calendar</h2>
        <CalendarView items={generalItems} monthsWindow={monthsWindow} todayDate={today} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">School Events</h2>

        {selectedSchool ? (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Showing events for <span className="font-medium text-slate-700">{selectedSchool.name}</span>.{" "}
              <a href="/calendar" className="text-mega-blue hover:underline">
                Choose a different school
              </a>
            </p>
            <CalendarView items={schoolEventItems} monthsWindow={monthsWindow} todayDate={today} />
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Search for a school to see its upcoming events.
            </p>
            <form method="get" className="flex gap-2 mb-4">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search for a school..."
                className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <button
                type="submit"
                className="bg-mega-navy text-white font-semibold px-5 py-2.5 rounded-full hover:bg-mega-blue transition text-sm"
              >
                Search
              </button>
            </form>

            {q && searchResults.length === 0 && (
              <p className="text-sm text-slate-400">No verified schools match &quot;{q}&quot;.</p>
            )}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((s) => (
                  <a
                    key={s.id}
                    href={`/calendar?school=${s.id}`}
                    className="block border border-slate-200 rounded-lg px-4 py-2.5 text-sm hover:border-mega-navy transition"
                  >
                    <span className="font-medium text-slate-800">{s.name}</span>
                    {s.location && <span className="text-slate-400"> · {s.location}</span>}
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
