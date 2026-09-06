/**
 * Calendar Annual view — pure date-grid math, no library, no database
 * access. Deliberately separate from calendar.ts (which is server-data
 * plumbing): this file is safe to import from a client component.
 */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * The first day of the month containing the given "YYYY-MM-DD" date, as
 * "YYYY-MM-DD". Used as the Annual view's fetch-window start so the
 * currently-displayed month's already-passed days (e.g. a holiday on
 * the 4th, viewed on the 7th) still appear on the grid — "today" alone
 * would silently exclude them from the query, even though the month
 * card showing those day-cells is still rendered.
 */
export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/**
 * 12 consecutive {year, month} pairs starting at the given "YYYY-MM-DD"
 * date's own month — a rolling annual window anchored to "today", never
 * a fixed Jan-Dec calendar year (there is no reliable BS-year-boundary
 * data to anchor a Nepali-calendar-shaped year to instead — see
 * docs/CALENDAR.md).
 */
export function getAnnualMonths(fromDateStr: string): { year: number; month: number }[] {
  const [y, m] = fromDateStr.split("-").map(Number);
  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const total = m - 1 + i;
    months.push({ year: y + Math.floor(total / 12), month: (total % 12) + 1 });
  }
  return months;
}

/**
 * A Sunday-first month grid as weeks of "YYYY-MM-DD" strings (or null
 * for the leading/trailing padding cells) — computed directly from
 * Date.UTC, never a manually-constructed date, so weekday alignment is
 * always mathematically correct.
 */
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday

  const cells: (string | null)[] = new Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
