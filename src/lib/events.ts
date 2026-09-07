import { prisma } from "@/lib/prisma";
import type { CalendarItem, CalendarWindow } from "@/lib/calendar";
import { formatKathmanduTime } from "@/lib/calendar";

/**
 * Active School Events for one school in the given window — School
 * Events are visible identically to every role at that school (Admin,
 * Teacher, Student, Parent), so this adapter does no per-role
 * filtering of its own; the caller is responsible for having already
 * verified the caller belongs to schoolId, matching every other
 * adapter's documented contract.
 */
export async function fetchSchoolEventItems(schoolId: string, window: CalendarWindow): Promise<CalendarItem[]> {
  const events = await prisma.event.findMany({
    where: {
      schoolId,
      isActive: true,
      startsAt: { gte: new Date(`${window.from}T00:00:00+05:45`), lte: new Date(`${window.to}T23:59:59+05:45`) },
    },
    orderBy: { startsAt: "asc" },
  });

  return events.map((e) => ({
    id: `Event:${e.id}`,
    title: e.title,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(e.startsAt),
    time: e.isAllDay ? null : formatKathmanduTime(e.startsAt),
    isAllDay: e.isAllDay,
    category: "SCHOOL_EVENT" as const,
    sourceType: "Event" as const,
    sourceId: e.id,
    scopeType: "SCHOOL" as const,
    scopeId: schoolId,
    description: e.description,
    location: e.location,
    link: null,
  }));
}

export type AdminEventRow = {
  id: string;
  title: string;
  description: string | null;
  date: string; // "YYYY-MM-DD", Kathmandu
  time: string | null; // "HH:MM", Kathmandu — null for all-day
  isAllDay: boolean;
  location: string | null;
};

/**
 * Calendar K1.1 — raw, editable Event rows for the School Admin's own
 * "manage my Events" list (CalendarEventForm.tsx), distinct from
 * fetchSchoolEventItems()'s read-only CalendarItem projection above.
 * Active only — a deactivated Event simply drops out of this list, same
 * as it already does from the Calendar display.
 */
export async function fetchSchoolEventsForAdmin(schoolId: string, window: CalendarWindow): Promise<AdminEventRow[]> {
  const events = await prisma.event.findMany({
    where: {
      schoolId,
      isActive: true,
      startsAt: { gte: new Date(`${window.from}T00:00:00+05:45`), lte: new Date(`${window.to}T23:59:59+05:45`) },
    },
    orderBy: { startsAt: "asc" },
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(e.startsAt),
    time: e.isAllDay ? null : formatKathmanduTime(e.startsAt),
    isAllDay: e.isAllDay,
    location: e.location,
  }));
}
