/**
 * Calendar K1 — shared helpers used by both the Event write path and
 * the Calendar source adapters. See docs/CALENDAR.md.
 *
 * CalendarItem is a pure application-level projection, never a
 * database model — every field here is produced by one of the source
 * adapters below (or in src/lib/homework.ts, src/lib/events.ts,
 * src/lib/academicProgress.ts) from an already-authoritative row.
 * Authorization always happens at the adapter's own query — by the
 * time a row becomes a CalendarItem, "is the caller allowed to see
 * this" has already been answered, so no audience/visibility field
 * exists on this shape.
 */
import { prisma } from "@/lib/prisma";

export type CalendarItemCategory =
  | "GENERAL"
  | "SCHOOL_EVENT"
  | "MEETING"
  | "HOMEWORK"
  | "ACADEMIC_PERIOD"
  | "SCHOOL_ACTIVITY";
export type CalendarSourceType =
  | "GeneralCalendarEntry"
  | "Event"
  | "ParentTeacherMeeting"
  | "Homework"
  | "AcademicSession"
  | "SchoolCalendarEntry";

export type CalendarItem = {
  id: string; // `${sourceType}:${sourceId}` — composite, collision-proof across five source tables
  title: string;
  date: string; // "YYYY-MM-DD" — the day this item is grouped under
  time: string | null; // Kathmandu-formatted time; null for all-day items
  isAllDay: boolean;
  category: CalendarItemCategory;
  sourceType: CalendarSourceType;
  sourceId: string;
  scopeType: "GENERAL" | "SCHOOL";
  scopeId: string | null; // schoolId, or null for GENERAL-scoped items
  description: string | null;
  location: string | null;
  link: string | null;
  // UI refinement (Annual Calendar) — populated only for category:"GENERAL"
  // items, carrying GeneralCalendarEntry's own `type` verbatim
  // ("NATIONAL_HOLIDAY" | "OBSERVANCE" | "MEGA_WIDE_EVENT") so the Annual
  // view can give a national holiday a different visual weight than an
  // observance. Undefined for every other source — this is additive only,
  // no existing consumer reads it. Also reused for category:"SCHOOL_ACTIVITY"
  // items, carrying SchoolCalendarEntry's own `category` verbatim
  // ("VACATION" | "EXAMINATION" | "SPECIAL_CLOSURE" | "PTM" | "RESULT_DAY" |
  // "REPORT_CARD_DISTRIBUTION").
  subType?: string;

  // Calendar K1.1 — Parent multi-child attribution. Populated ONLY by the
  // Parent Calendar's own per-child aggregation loop
  // (src/app/dashboard/calendar/page.tsx), for genuinely per-student
  // sources (Homework, ParentTeacherMeeting) — never for school-wide
  // items (Event, AcademicSession, SchoolCalendarEntry, GeneralCalendarEntry),
  // and never undefined-vs-null ambiguity: simply absent for every other
  // caller (Admin, Teacher, Student, public). The underlying adapters and
  // their non-Parent callers are unmodified.
  childId?: string;
  childName?: string;
};

export type CalendarWindow = { from: string; to: string }; // both "YYYY-MM-DD"

function formatKathmanduDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(instant);
}

function formatKathmanduTime(instant: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

/**
 * Every General Calendar entry active in the given window — no
 * authorization of its own (this data is public by design), no school
 * scoping (deliberately shared network-wide, per the approved design —
 * a tiny, shared table, never joined against the large per-school
 * sources below).
 */
export async function fetchGeneralCalendarItems(window: CalendarWindow): Promise<CalendarItem[]> {
  const entries = await prisma.generalCalendarEntry.findMany({
    where: {
      isActive: true,
      date: { gte: new Date(window.from), lte: new Date(window.to) },
    },
    orderBy: [{ date: "asc" }, { title: "asc" }],
  });
  return entries.map((e) => ({
    id: `GeneralCalendarEntry:${e.id}`,
    title: e.title,
    date: e.date.toISOString().slice(0, 10),
    time: null,
    isAllDay: true,
    category: "GENERAL",
    sourceType: "GeneralCalendarEntry",
    sourceId: e.id,
    scopeType: "GENERAL",
    scopeId: null,
    description: e.description,
    location: null,
    link: null,
    subType: e.type,
  }));
}

/**
 * AcademicSession start/end boundaries falling in the window, for one
 * school — informational markers only, never something anyone
 * "attends." Caller must already be authorized for schoolId (this
 * function does no authorization of its own, matching every other
 * adapter's documented contract).
 */
export async function fetchAcademicSessionBoundaries(
  schoolId: string,
  window: CalendarWindow
): Promise<CalendarItem[]> {
  const from = new Date(window.from);
  const to = new Date(window.to);
  const sessions = await prisma.academicSession.findMany({
    where: {
      schoolId,
      OR: [{ startDate: { gte: from, lte: to } }, { endDate: { gte: from, lte: to } }],
    },
  });

  const items: CalendarItem[] = [];
  for (const s of sessions) {
    if (s.startDate >= from && s.startDate <= to) {
      items.push({
        id: `AcademicSession:${s.id}:start`,
        title: `${s.name} begins`,
        date: s.startDate.toISOString().slice(0, 10),
        time: null,
        isAllDay: true,
        category: "ACADEMIC_PERIOD",
        sourceType: "AcademicSession",
        sourceId: s.id,
        scopeType: "SCHOOL",
        scopeId: schoolId,
        description: null,
        location: null,
        link: null,
      });
    }
    if (s.endDate >= from && s.endDate <= to) {
      items.push({
        id: `AcademicSession:${s.id}:end`,
        title: `${s.name} ends`,
        date: s.endDate.toISOString().slice(0, 10),
        time: null,
        isAllDay: true,
        category: "ACADEMIC_PERIOD",
        sourceType: "AcademicSession",
        sourceId: s.id,
        scopeType: "SCHOOL",
        scopeId: schoolId,
        description: null,
        location: null,
        link: null,
      });
    }
  }
  return items;
}

/**
 * Merges already-projected CalendarItem arrays from any number of
 * adapters into one sorted, grouped agenda — pure application-code
 * merge, never a database-level UNION across the five source tables.
 */
export function mergeAndGroupCalendarItems(itemLists: CalendarItem[][]): { date: string; items: CalendarItem[] }[] {
  const all = itemLists.flat();
  all.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time ?? "00:00";
    const bt = b.time ?? "00:00";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.title.localeCompare(b.title); // deterministic, stable tie-breaker
  });

  const grouped: { date: string; items: CalendarItem[] }[] = [];
  for (const item of all) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === item.date) {
      last.items.push(item);
    } else {
      grouped.push({ date: item.date, items: [item] });
    }
  }
  return grouped;
}

/** Adds `days` to a "YYYY-MM-DD" string, returning the same format. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export { formatKathmanduDate, formatKathmanduTime };

/**
 * Builds a real Date instant anchored to Asia/Kathmandu (UTC+5:45),
 * given a client-supplied "YYYY-MM-DD" date and an optional "HH:MM"
 * time. Never uses the server's own local timezone — the offset is
 * always the explicit, hardcoded Nepal one, matching todayInKathmandu()
 * (src/lib/homework.ts)'s own reasoning for why this can't be process-
 * local.
 *
 * When no time is given, resolves to Kathmandu local midnight for that
 * date — used only as the technical placeholder an all-day Event's
 * non-nullable `startsAt` column requires. Calendar rendering must
 * never infer meaning from this stored instant; `isAllDay` is the only
 * authoritative signal (see the Event model's own doc comment).
 */
export function kathmanduInstant(date: string, time?: string | null): Date {
  const [hh, mm] = time ? time.split(":") : ["00", "00"];
  return new Date(`${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00+05:45`);
}
