import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import { todayInKathmandu } from "@/lib/homework";
import { addDaysToDateString, fetchGeneralCalendarItems, fetchAcademicSessionBoundaries, type CalendarItem } from "@/lib/calendar";
import { getAnnualMonths, monthLabel, startOfMonth } from "@/lib/monthGrid";
import { fetchSchoolEventItems } from "@/lib/events";
import { fetchHomeworkForTeacher, fetchHomeworkForSchool } from "@/lib/homework";
import { fetchMeetingsForTeacher, fetchMeetingsForSchool, teacherMeetingRowsToCalendarItems } from "@/lib/academicProgress";
import CalendarView from "@/components/CalendarView";
import CalendarEventForm from "@/components/CalendarEventForm";

export const dynamic = "force-dynamic";

/**
 * Calendar K1 — School Admin/Teacher entry point, URL-scoped exactly
 * like Homework/Attendance/Meetings before it: no unscoped legacy
 * sibling, since Calendar has no pre-Phase-4D history to preserve.
 * verifySchoolAccess() is re-checked fresh on every request; the URL's
 * schoolId is the sole authorization boundary, never the
 * mega_school_ctx cookie.
 */
export default async function SchoolCalendarPage({ params }: { params: { schoolId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access) redirect("/dashboard");

  const schoolId = params.schoolId;
  const today = todayInKathmandu();
  const from = startOfMonth(today);
  const to = addDaysToDateString(from, 365);
  const window = { from, to };
  const monthsWindow = getAnnualMonths(today);

  const [general, events, sessions] = await Promise.all([
    fetchGeneralCalendarItems(window),
    fetchSchoolEventItems(schoolId, window),
    fetchAcademicSessionBoundaries(schoolId, window),
  ]);

  let meetingItems: CalendarItem[] = [];
  let homeworkItems: CalendarItem[] = [];

  if (access.role === "SCHOOL_ADMIN") {
    const [meetingRows, homework] = await Promise.all([
      fetchMeetingsForSchool(schoolId, window),
      fetchHomeworkForSchool(schoolId, window),
    ]);
    meetingItems = teacherMeetingRowsToCalendarItems(meetingRows, schoolId, window);
    homeworkItems = homework;
  } else {
    const [meetingRows, homework] = await Promise.all([
      fetchMeetingsForTeacher(access.teacherId, schoolId, { when: "upcoming" }),
      fetchHomeworkForTeacher(access.teacherId, schoolId, window),
    ]);
    meetingItems = teacherMeetingRowsToCalendarItems(meetingRows, schoolId, window);
    homeworkItems = homework;
  }

  const items = [...general, ...events, ...sessions, ...meetingItems, ...homeworkItems];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Calendar</h1>
      <p className="text-slate-500 text-sm mb-6">
        {monthLabel(monthsWindow[0].year, monthsWindow[0].month)} –{" "}
        {monthLabel(monthsWindow[11].year, monthsWindow[11].month)}
      </p>

      {access.role === "SCHOOL_ADMIN" && <CalendarEventForm schoolId={schoolId} />}

      <CalendarView items={items} monthsWindow={monthsWindow} todayDate={today} />
    </div>
  );
}
