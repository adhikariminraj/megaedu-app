/**
 * Calendar K1.1 — SchoolCalendarEntry: school-scoped institutional
 * calendar rows (Vacation/Examination/Special Closure ranges, and
 * PTM/Result Day/Report Card Distribution point activities) plus the
 * Day Status resolution layer that sits alongside — never inside —
 * the existing CalendarItem projection. See docs/CALENDAR.md.
 */
import { prisma } from "@/lib/prisma";
import { addDaysToDateString, type CalendarItem, type CalendarWindow } from "@/lib/calendar";

export const RANGE_CATEGORIES = ["VACATION", "EXAMINATION", "SPECIAL_CLOSURE"] as const;
export const POINT_CATEGORIES = ["PTM", "RESULT_DAY", "REPORT_CARD_DISTRIBUTION"] as const;
export const SCHOOL_CALENDAR_CATEGORIES = [...RANGE_CATEGORIES, ...POINT_CATEGORIES] as const;
export type SchoolCalendarCategory = (typeof SCHOOL_CALENDAR_CATEGORIES)[number];

const CATEGORY_TITLES: Record<SchoolCalendarCategory, string> = {
  VACATION: "Vacation",
  EXAMINATION: "Examination",
  SPECIAL_CLOSURE: "Special Closure",
  PTM: "Parent-Teacher Meeting",
  RESULT_DAY: "Result Day",
  REPORT_CARD_DISTRIBUTION: "Report Card Distribution",
};

/**
 * The one place category <-> date-shape <-> affectsDayStatus semantics
 * are enforced. affectsDayStatus is NEVER accepted from the client —
 * it is entirely derived from category here. Used by both the create
 * and edit routes so an Admin can never produce, e.g., a PTM row with
 * affectsDayStatus:true or a Vacation row with startDate > endDate.
 */
export function resolveSchoolCalendarEntryDates(
  category: string,
  body: { date?: unknown; startDate?: unknown; endDate?: unknown }
): { startDate: Date; endDate: Date; affectsDayStatus: boolean } | { error: string } {
  if (!SCHOOL_CALENDAR_CATEGORIES.includes(category as SchoolCalendarCategory)) {
    return { error: `Unknown category "${category}".` };
  }

  const isRange = (RANGE_CATEGORIES as readonly string[]).includes(category);

  if (isRange) {
    if (typeof body.startDate !== "string" || typeof body.endDate !== "string" || !body.startDate || !body.endDate) {
      return { error: `${CATEGORY_TITLES[category as SchoolCalendarCategory]} requires a start date and end date.` };
    }
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { error: "Invalid start or end date." };
    }
    if (startDate > endDate) {
      return { error: "Start date must be on or before the end date." };
    }
    return { startDate, endDate, affectsDayStatus: true };
  }

  if (typeof body.date !== "string" || !body.date) {
    return { error: `${CATEGORY_TITLES[category as SchoolCalendarCategory]} requires a date.` };
  }
  const date = new Date(body.date);
  if (isNaN(date.getTime())) {
    return { error: "Invalid date." };
  }
  return { startDate: date, endDate: date, affectsDayStatus: false };
}

// ============================================================
// CalendarItem projection
// ============================================================

/**
 * SchoolCalendarEntry rows, active and overlapping the window, projected
 * to CalendarItem. Point activities (PTM/RESULT_DAY/REPORT_CARD_DISTRIBUTION)
 * appear once on their own date. Range activities (VACATION/EXAMINATION/
 * SPECIAL_CLOSURE) appear once, anchored on their start date, rather than
 * repeated on every day of the range — the range itself is already
 * communicated continuously by the Day Status background; repeating the
 * same title under every day of an 8-day vacation would flood the
 * month's compact list for no added information.
 *
 * studentContext, when supplied, is used ONLY to link RESULT_DAY/
 * REPORT_CARD_DISTRIBUTION items to that specific student's real report
 * card page — never to attribute a school-wide date to one child by
 * name (name attribution is a Parent-only concern threaded separately
 * by the caller, matching Homework/Meeting's own childName handling).
 */
export async function fetchSchoolCalendarEntryItems(
  schoolId: string,
  window: CalendarWindow,
  studentContext?: { studentId: string }
): Promise<CalendarItem[]> {
  const entries = await prisma.schoolCalendarEntry.findMany({
    where: {
      schoolId,
      isActive: true,
      startDate: { lte: new Date(window.to) },
      endDate: { gte: new Date(window.from) },
    },
    orderBy: { startDate: "asc" },
  });

  return entries.map((e) => {
    const category = e.category as SchoolCalendarCategory;
    const isRange = (RANGE_CATEGORIES as readonly string[]).includes(category);
    const startStr = e.startDate.toISOString().slice(0, 10);
    const endStr = e.endDate.toISOString().slice(0, 10);
    const isReportCardKind = category === "RESULT_DAY" || category === "REPORT_CARD_DISTRIBUTION";

    return {
      id: `SchoolCalendarEntry:${e.id}`,
      title: e.title,
      date: startStr,
      time: null,
      isAllDay: true,
      category: "SCHOOL_ACTIVITY",
      sourceType: "SchoolCalendarEntry",
      sourceId: e.id,
      scopeType: "SCHOOL",
      scopeId: schoolId,
      description: isRange && startStr !== endStr ? `${startStr} – ${endStr}` : e.description,
      location: null,
      link: isReportCardKind && studentContext ? `/dashboard/report-card/${studentContext.studentId}` : null,
      subType: category,
    };
  });
}

export type AdminSchoolCalendarEntryRow = {
  id: string;
  title: string;
  category: SchoolCalendarCategory;
  description: string | null;
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD" — equal to startDate for a point activity
};

/**
 * Raw, editable SchoolCalendarEntry rows for the School Admin's own
 * management list — active only, same convention as
 * fetchSchoolEventsForAdmin().
 */
export async function fetchSchoolCalendarEntriesForAdmin(
  schoolId: string,
  window: CalendarWindow
): Promise<AdminSchoolCalendarEntryRow[]> {
  const entries = await prisma.schoolCalendarEntry.findMany({
    where: {
      schoolId,
      isActive: true,
      startDate: { lte: new Date(window.to) },
      endDate: { gte: new Date(window.from) },
    },
    orderBy: { startDate: "asc" },
  });

  return entries.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category as SchoolCalendarCategory,
    description: e.description,
    startDate: e.startDate.toISOString().slice(0, 10),
    endDate: e.endDate.toISOString().slice(0, 10),
  }));
}

// ============================================================
// Day Status resolution — a per-DATE layer, deliberately separate
// from CalendarItem. See docs/CALENDAR.md "Day Status vs Activities".
// ============================================================

export type DayStatus = "SPECIAL_CLOSURE" | "EXAMINATION" | "VACATION" | "PUBLIC_HOLIDAY" | "WEEKLY_HOLIDAY";

const DAY_STATUS_PRIORITY: DayStatus[] = [
  "SPECIAL_CLOSURE",
  "EXAMINATION",
  "VACATION",
  "PUBLIC_HOLIDAY",
  "WEEKLY_HOLIDAY",
];

function eachDateInRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  let cur = fromStr;
  let guard = 0;
  while (cur <= toStr && guard < 3660) {
    dates.push(cur);
    cur = addDaysToDateString(cur, 1);
    guard++;
  }
  return dates;
}

/**
 * Resolves exactly one dominant DayStatus per date in the window — no
 * blended/combination treatment (see docs/CALENDAR.md). schoolId is
 * optional: pass null for a school-less context (public General
 * Calendar before a school is selected) to get Public Holiday / Weekly
 * Holiday only, with no SchoolCalendarEntry query at all.
 *
 * Only GeneralCalendarEntry rows with type "NATIONAL_HOLIDAY" ever
 * produce a Day Status — "OBSERVANCE"/"MEGA_WIDE_EVENT" rows are
 * informational only and must never imply school is closed.
 *
 * Weekly Holiday (Saturday) is computed here, on every call, from the
 * date's own weekday — never stored, never a per-school setting in
 * this kilometer.
 */
export async function resolveDayStatuses(
  schoolId: string | null,
  window: CalendarWindow
): Promise<Map<string, DayStatus>> {
  const candidates = new Map<string, DayStatus[]>();
  const addCandidate = (date: string, status: DayStatus) => {
    const list = candidates.get(date);
    if (list) list.push(status);
    else candidates.set(date, [status]);
  };

  const holidays = await prisma.generalCalendarEntry.findMany({
    where: {
      isActive: true,
      type: "NATIONAL_HOLIDAY",
      date: { gte: new Date(window.from), lte: new Date(window.to) },
    },
    select: { date: true },
  });
  for (const h of holidays) {
    addCandidate(h.date.toISOString().slice(0, 10), "PUBLIC_HOLIDAY");
  }

  if (schoolId) {
    const ranges = await prisma.schoolCalendarEntry.findMany({
      where: {
        schoolId,
        isActive: true,
        affectsDayStatus: true,
        startDate: { lte: new Date(window.to) },
        endDate: { gte: new Date(window.from) },
      },
      select: { category: true, startDate: true, endDate: true },
    });
    for (const r of ranges) {
      const from = r.startDate.toISOString().slice(0, 10) < window.from ? window.from : r.startDate.toISOString().slice(0, 10);
      const to = r.endDate.toISOString().slice(0, 10) > window.to ? window.to : r.endDate.toISOString().slice(0, 10);
      for (const date of eachDateInRange(from, to)) {
        addCandidate(date, r.category as DayStatus);
      }
    }
  }

  for (const date of eachDateInRange(window.from, window.to)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 6) addCandidate(date, "WEEKLY_HOLIDAY");
  }

  const resolved = new Map<string, DayStatus>();
  for (const [date, statuses] of candidates) {
    for (const status of DAY_STATUS_PRIORITY) {
      if (statuses.includes(status)) {
        resolved.set(date, status);
        break;
      }
    }
  }
  return resolved;
}

/**
 * Combines several already-resolved DayStatus maps (one per distinct
 * school) into one, using the same priority order — needed only for a
 * Parent whose linked children attend different schools with
 * potentially different Vacation/Examination schedules on the same
 * date. Each input map is already itself fully resolved; this just
 * re-applies the same priority across maps.
 */
export function mergeDayStatuses(maps: Map<string, DayStatus>[]): Map<string, DayStatus> {
  const merged = new Map<string, DayStatus>();
  for (const map of maps) {
    for (const [date, status] of map) {
      const existing = merged.get(date);
      if (!existing || DAY_STATUS_PRIORITY.indexOf(status) < DAY_STATUS_PRIORITY.indexOf(existing)) {
        merged.set(date, status);
      }
    }
  }
  return merged;
}
