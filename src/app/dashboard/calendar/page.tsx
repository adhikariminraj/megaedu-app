import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayInKathmandu, fetchHomeworkDueForStudent } from "@/lib/homework";
import { addDaysToDateString, fetchGeneralCalendarItems, fetchAcademicSessionBoundaries, type CalendarItem } from "@/lib/calendar";
import { getAnnualMonths, monthLabel, startOfMonth } from "@/lib/monthGrid";
import { fetchSchoolEventItems } from "@/lib/events";
import { fetchMeetingsForStudent, parentMeetingRowsToCalendarItems } from "@/lib/academicProgress";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

/**
 * Calendar K1 — Student/Parent entry point. Never part of the Phase 4D
 * institutional-context migration (neither role has one), so this page
 * resolves the caller's own scope directly from their session identity
 * — never a schoolId in the URL, matching how every other Student/
 * Parent-facing surface in this app already works.
 */
export default async function SelfCalendarPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const today = todayInKathmandu();
  const from = startOfMonth(today);
  const to = addDaysToDateString(from, 365);
  const window = { from, to };
  const monthsWindow = getAnnualMonths(today);
  const rangeLabel = `${monthLabel(monthsWindow[0].year, monthsWindow[0].month)} – ${monthLabel(
    monthsWindow[11].year,
    monthsWindow[11].month
  )}`;

  const student = await prisma.student.findUnique({ where: { userId } });
  if (student) {
    if (!student.schoolId) redirect("/dashboard");
    const schoolId = student.schoolId;

    const [general, events, sessions, homework] = await Promise.all([
      fetchGeneralCalendarItems(window),
      fetchSchoolEventItems(schoolId, window),
      fetchAcademicSessionBoundaries(schoolId, window),
      fetchHomeworkDueForStudent(student.id, schoolId, window),
    ]);

    const items = [...general, ...events, ...sessions, ...homework];
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Calendar</h1>
        <p className="text-slate-500 text-sm mb-6">{rangeLabel}</p>
        <CalendarView items={items} monthsWindow={monthsWindow} todayDate={today} />
      </div>
    );
  }

  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: { children: { include: { student: true } } },
  });
  if (parent) {
    const general = await fetchGeneralCalendarItems(window);
    const perChild = await Promise.all(
      parent.children
        .filter((c) => !!c.student.schoolId)
        .map(async (c) => {
          const schoolId = c.student.schoolId as string;
          const [events, sessions, homework, meetingRows] = await Promise.all([
            fetchSchoolEventItems(schoolId, window),
            fetchAcademicSessionBoundaries(schoolId, window),
            fetchHomeworkDueForStudent(c.student.id, schoolId, window),
            fetchMeetingsForStudent(c.student.id, "PARENT"),
          ]);
          const meetings = parentMeetingRowsToCalendarItems(meetingRows, schoolId, window);
          return [events, sessions, homework, meetings] as CalendarItem[][];
        })
    );

    const items = [general, ...perChild.flat()].flat();
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">Calendar</h1>
        <p className="text-slate-500 text-sm mb-6">{rangeLabel} · across your children.</p>
        <CalendarView items={items} monthsWindow={monthsWindow} todayDate={today} />
      </div>
    );
  }

  redirect("/dashboard");
}
