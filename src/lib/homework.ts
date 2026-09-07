import { prisma } from "@/lib/prisma";
import { sectionScopeWhere } from "@/lib/authorize";
import type { CalendarItem, CalendarWindow } from "@/lib/calendar";

/**
 * Today's calendar date in Asia/Kathmandu, as a "YYYY-MM-DD" string.
 * Deliberately NOT `new Date().toISOString().slice(0, 10)` — that
 * reflects the UTC calendar date, which diverges from Nepal's actual
 * local date for roughly the first ~5h45m of every Nepal day (NPT is
 * UTC+5:45), exactly the early-morning window a parent checking
 * "today's homework" before the school day starts is most likely to
 * hit. Hardcoded to this one timezone deliberately — this platform is
 * Nepal-only today, and no School has ever had (or needed) its own
 * timezone field; adding one now would be speculative infrastructure
 * for a scenario that doesn't exist yet.
 */
export function todayInKathmandu(): string {
  // en-CA's locale format is exactly YYYY-MM-DD, so no manual
  // reassembly of Intl's parts is needed.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

export type HomeworkRow = {
  id: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string; // "YYYY-MM-DD"
};

/**
 * Today's PUBLISHED homework applicable to one student, resolved
 * entirely from that student's current institutional placement — never
 * a stored per-student row. Shared by the Student's own dashboard and,
 * once per linked child, the Parent dashboard — the same
 * "one function, every caller" discipline already established by
 * fetchAcademicProgress() (src/lib/academicProgress.ts), so the two
 * views can never drift apart. Callers are responsible for only ever
 * passing a studentId they've already verified the caller is allowed to
 * see — this function itself does no authorization, matching
 * fetchAcademicProgress()'s own documented contract.
 */
export async function fetchTodaysHomework(studentId: string): Promise<HomeworkRow[]> {
  const currentPlacement = await prisma.gradeHistory.findFirst({
    where: { studentId, academicSession: { status: "ACTIVE" } },
  });
  if (!currentPlacement) return [];

  const today = new Date(todayInKathmandu());

  const homework = await prisma.homework.findMany({
    where: {
      status: "PUBLISHED",
      academicSessionId: currentPlacement.academicSessionId,
      schoolGradeId: currentPlacement.schoolGradeId,
      dueDate: today,
      ...sectionScopeWhere(currentPlacement.sectionId),
    },
    include: { subject: true },
    orderBy: { subject: { name: "asc" } },
  });

  return homework.map((hw) => ({
    id: hw.id,
    subjectName: hw.subject.name,
    title: hw.title,
    instructions: hw.instructions,
    dueDate: hw.dueDate.toISOString().slice(0, 10),
  }));
}

function toHomeworkCalendarItem(
  hw: { id: string; title: string; instructions: string; dueDate: Date; subject: { name: string } },
  schoolId: string,
  options?: { link?: string | null; child?: { id: string; name: string } }
): CalendarItem {
  const childName = options?.child?.name;
  // A single Homework row can legitimately project into more than one
  // CalendarItem — two siblings in the same grade/section both get it —
  // so the id must incorporate the child, or React (and any consumer
  // keying off id) sees two items with an identical key.
  const id = options?.child ? `Homework:${hw.id}:${options.child.id}` : `Homework:${hw.id}`;
  return {
    id,
    title: childName ? `${childName} — ${hw.subject.name} — ${hw.title}` : `${hw.subject.name} — ${hw.title}`,
    date: hw.dueDate.toISOString().slice(0, 10),
    time: null,
    isAllDay: true,
    category: "HOMEWORK",
    sourceType: "Homework",
    sourceId: hw.id,
    scopeType: "SCHOOL",
    scopeId: schoolId,
    description: hw.instructions,
    location: null,
    link: options?.link ?? null,
    childId: options?.child?.id,
    childName,
  };
}

/**
 * Calendar K1 — PUBLISHED homework due within a date window for one
 * student. A sibling of fetchTodaysHomework(), not a replacement:
 * identical placement-resolution/sectionScopeWhere() logic, just
 * dueDate widened from an exact match to a range. fetchTodaysHomework()
 * itself is untouched — no existing caller's behavior changes.
 */
export async function fetchHomeworkDueForStudent(
  studentId: string,
  schoolId: string,
  window: CalendarWindow,
  child?: { id: string; name: string }
): Promise<CalendarItem[]> {
  const currentPlacement = await prisma.gradeHistory.findFirst({
    where: { studentId, academicSession: { status: "ACTIVE" } },
  });
  if (!currentPlacement) return [];

  const homework = await prisma.homework.findMany({
    where: {
      status: "PUBLISHED",
      academicSessionId: currentPlacement.academicSessionId,
      schoolGradeId: currentPlacement.schoolGradeId,
      dueDate: { gte: new Date(window.from), lte: new Date(window.to) },
      ...sectionScopeWhere(currentPlacement.sectionId),
    },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });

  // No link: no per-student homework detail page exists for
  // Student/Parent today — leaving this null is honest, not an
  // oversight (see docs/CALENDAR.md).
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link: null, child }));
}

/**
 * Calendar K1 — homework a Teacher has authored, due within a date
 * window. Uses the existing [teacherId] index; no per-role filtering
 * beyond teacherId, matching the caller's own already-verified
 * identity, same contract as every other adapter here.
 */
export async function fetchHomeworkForTeacher(
  teacherId: string,
  schoolId: string,
  window: CalendarWindow
): Promise<CalendarItem[]> {
  const homework = await prisma.homework.findMany({
    where: { teacherId, dueDate: { gte: new Date(window.from), lte: new Date(window.to) } },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });
  const link = `/dashboard/schools/${schoolId}/homework`;
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link }));
}

/**
 * Calendar K1 — every homework item due at a school within a date
 * window, School Admin's own scope. Uses the existing
 * [schoolGradeId, dueDate] index via the SchoolGrade join.
 */
export async function fetchHomeworkForSchool(schoolId: string, window: CalendarWindow): Promise<CalendarItem[]> {
  const homework = await prisma.homework.findMany({
    where: {
      schoolGrade: { schoolId },
      dueDate: { gte: new Date(window.from), lte: new Date(window.to) },
    },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });
  const link = `/dashboard/schools/${schoolId}/homework`;
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link }));
}
