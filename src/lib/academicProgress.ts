import { prisma } from "@/lib/prisma";
import type { AttendanceRow, ProgressRow, TestResultRow, EvaluationRow } from "@/components/AcademicProgressPanel";
import type { CalendarItem, CalendarWindow } from "@/lib/calendar";
import { formatKathmanduTime } from "@/lib/calendar";
import { resolveCurrentPlacement } from "@/lib/gradeHistory";

/**
 * The Phase 3B/3C academic summary (attendance, teaching progress, test
 * results, evaluations) for exactly one student — the sole place this
 * query shape is written, shared by the STUDENT branch (their own
 * data), the PARENT branch (once per linked child), and the Phase 3C-2
 * Student Profile page (School Admin / Teacher, read-only) in
 * dashboard/page.tsx and dashboard/students/[studentId]/page.tsx
 * respectively — so none of the three ever drift apart. Callers are
 * responsible for only ever passing a studentId they've already
 * verified the caller is allowed to see — this function itself does no
 * authorization.
 *
 * `audience` controls which StudentEvaluation rows come back:
 * - "STUDENT" filters on visibleToStudent
 * - "PARENT" filters on visibleToParent
 * - "STAFF" applies no visibility filter at all — a School Admin or
 *   Teacher viewing a Student Profile is not the gated audience those
 *   two flags exist for; they see every evaluation regardless of
 *   sharing status, the same way the evaluation-management pages
 *   already do.
 *
 * "STUDENT"/"PARENT" are fully independent gates (a Student and their
 * Parent may legitimately see different evaluations), so this function
 * is always called once per intended audience, never shared between a
 * Student's own view and a Parent's view of that same child.
 *
 * schoolId scopes the current-placement lookup used for Teaching
 * Progress (see resolveCurrentPlacement() in src/lib/gradeHistory.ts) —
 * pass null only when no school context is available at all, in which
 * case Teaching Progress is correctly empty rather than guessed.
 */
export async function fetchAcademicProgress(
  studentId: string,
  schoolId: string | null,
  audience: "STUDENT" | "PARENT" | "STAFF"
): Promise<{
  attendance: AttendanceRow[];
  teachingProgress: ProgressRow[];
  testResults: TestResultRow[];
  evaluations: EvaluationRow[];
}> {
  const evaluationVisibilityFilter =
    audience === "STUDENT"
      ? { visibleToStudent: true }
      : audience === "PARENT"
      ? { visibleToParent: true }
      : {};

  const [recentAttendance, currentPlacement, testResults, evaluations] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      take: 15,
    }),
    schoolId ? resolveCurrentPlacement(studentId, schoolId) : Promise.resolve(null),
    prisma.unitTestResult.findMany({
      where: { studentId },
      include: { unitTest: { include: { unit: { include: { subject: true } } } } },
      orderBy: { unitTest: { testDate: "desc" } },
      take: 20,
    }),
    prisma.studentEvaluation.findMany({
      where: { studentId, ...evaluationVisibilityFilter },
      include: { teacher: { include: { user: true } }, gradeSubject: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  let teachingProgress: ProgressRow[] = [];
  if (currentPlacement) {
    const gradeSubjects = await prisma.gradeSubject.findMany({
      where: { schoolGradeId: currentPlacement.schoolGradeId, academicSessionId: currentPlacement.academicSessionId },
      include: {
        subject: true,
        teachingUnits: {
          where: currentPlacement.sectionId
            ? { OR: [{ sectionId: null }, { sectionId: currentPlacement.sectionId }] }
            : { sectionId: null },
        },
      },
    });
    teachingProgress = gradeSubjects.map((gs) => ({
      subjectName: gs.subject.name,
      total: gs.teachingUnits.length,
      completed: gs.teachingUnits.filter((u) => u.status === "COMPLETED").length,
      inProgress: gs.teachingUnits.filter((u) => u.status === "IN_PROGRESS").length,
    }));
  }

  return {
    attendance: recentAttendance.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      status: a.status,
      remarks: a.remarks,
    })),
    teachingProgress,
    testResults: testResults.map((r) => ({
      id: r.id,
      testTitle: r.unitTest.title,
      unitTitle: r.unitTest.unit.title,
      subjectName: r.unitTest.unit.subject.name,
      testDate: r.unitTest.testDate.toISOString().slice(0, 10),
      maxMarks: r.unitTest.maxMarks,
      status: r.status,
      marksObtained: r.marksObtained,
      remarks: r.remarks,
    })),
    evaluations: evaluations.map((ev) => ({
      id: ev.id,
      teacherName: ev.teacher.fullName,
      subjectName: ev.gradeSubject?.subject.name ?? null,
      remarks: ev.remarks,
      createdAt: ev.createdAt.toISOString().slice(0, 10),
    })),
  };
}

export type MeetingRow = {
  id: string;
  teacherName: string;
  subjectName: string | null;
  scheduledAt: string;
  location: string | null;
  onlineUrl: string | null;
  status: string;
  outcomeNotes: string | null;
  linkedEvaluationRemarks: string | null;
};

/**
 * ParentTeacherMeeting read data for exactly one student. Called from
 * the PARENT branch of dashboard/page.tsx and from the Phase 3C-2
 * Student Profile page (School Admin / Teacher) — deliberately NEVER
 * from the STUDENT branch: Students have no PTM visibility in this
 * phase (see PRODUCT_RULES.md), kept as a structurally separate code
 * path, not just a hidden UI section, so there's no query result a
 * Student's own page could ever accidentally render.
 *
 * A linked evaluation's remarks are surfaced only when that evaluation
 * is ALSO visible to the requested audience — gated inside this
 * function so no caller has to remember the check itself. Staff (no
 * gate) always see it if a link exists; a Parent sees it only if the
 * linked evaluation's own visibleToParent is true.
 */
export async function fetchMeetingsForStudent(
  studentId: string,
  audience: "PARENT" | "STAFF"
): Promise<MeetingRow[]> {
  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: { studentId },
    include: {
      teacher: { include: { user: true } },
      gradeSubject: { include: { subject: true } },
      linkedEvaluation: { select: { remarks: true, visibleToParent: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 20,
  });
  return meetings.map((m) => ({
    id: m.id,
    teacherName: m.teacher.fullName,
    subjectName: m.gradeSubject?.subject.name ?? null,
    scheduledAt: m.scheduledAt.toISOString(),
    location: m.location,
    onlineUrl: m.onlineUrl,
    status: m.status,
    outcomeNotes: m.outcomeNotes,
    linkedEvaluationRemarks:
      m.linkedEvaluation && (audience === "STAFF" || m.linkedEvaluation.visibleToParent)
        ? m.linkedEvaluation.remarks
        : null,
  }));
}

export type TeacherMeetingRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  subjectName: string | null;
  scheduledAt: string;
  location: string | null;
  onlineUrl: string | null;
  status: string;
  outcomeNotes: string | null;
};

/**
 * A Teacher's own ParentTeacherMeetings at one school — the identical
 * query shape (where/include/orderBy) that both /dashboard/meetings and
 * /dashboard/schools/[schoolId]/meetings previously wrote independently
 * for their own non-admin branch. Extracted here so there is exactly
 * one place this retrieval is written, reused by both pages AND the
 * Teacher Today panel (which calls it with no filters beyond
 * `when: "upcoming"` to find today's soonest meeting) — matching the
 * "one function, every caller" discipline already established by
 * fetchAcademicProgress()/fetchMeetingsForStudent().
 *
 * `filters` mirrors exactly the status/when query-param handling the
 * two pages already had inline — nothing new is introduced, this is a
 * relocation, not a redesign. Like fetchMeetingsForStudent(), this
 * function does no authorization itself: callers are responsible for
 * only ever passing a teacherId they've already verified the caller is
 * allowed to see (their own resolved Teacher identity — never a
 * client-supplied id).
 */
export async function fetchMeetingsForTeacher(
  teacherId: string,
  schoolId: string,
  filters?: { status?: string | null; when?: "all" | "upcoming" | "past" }
): Promise<TeacherMeetingRow[]> {
  const whenFilter = filters?.when ?? "all";
  const now = new Date();
  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: {
      schoolId,
      teacherId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(whenFilter === "upcoming" ? { scheduledAt: { gte: now } } : {}),
      ...(whenFilter === "past" ? { scheduledAt: { lt: now } } : {}),
    },
    include: {
      teacher: { include: { user: true } },
      student: { include: { user: true } },
      gradeSubject: { include: { subject: true } },
    },
    orderBy: { scheduledAt: whenFilter === "past" ? "desc" : "asc" },
  });
  return meetings.map((m) => ({
    id: m.id,
    teacherId: m.teacherId,
    teacherName: m.teacher.fullName,
    studentId: m.studentId,
    studentName: m.student.fullName,
    subjectName: m.gradeSubject?.subject.name ?? null,
    scheduledAt: m.scheduledAt.toISOString(),
    location: m.location,
    onlineUrl: m.onlineUrl,
    status: m.status,
    outcomeNotes: m.outcomeNotes,
  }));
}

/**
 * Calendar K1 — every ParentTeacherMeeting at a school within a date
 * window, School Admin's own scope. A new function, not a
 * modification of fetchMeetingsForTeacher() above — Admin's meeting
 * view has always been "every meeting at the school," a genuinely
 * different query shape than "one teacher's own," so it gets its own
 * small function rather than overloading an existing one.
 */
export async function fetchMeetingsForSchool(schoolId: string, window: CalendarWindow): Promise<TeacherMeetingRow[]> {
  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: {
      schoolId,
      scheduledAt: { gte: new Date(`${window.from}T00:00:00+05:45`), lte: new Date(`${window.to}T23:59:59+05:45`) },
    },
    include: {
      teacher: { include: { user: true } },
      student: { include: { user: true } },
      gradeSubject: { include: { subject: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });
  return meetings.map((m) => ({
    id: m.id,
    teacherId: m.teacherId,
    teacherName: m.teacher.fullName,
    studentId: m.studentId,
    studentName: m.student.fullName,
    subjectName: m.gradeSubject?.subject.name ?? null,
    scheduledAt: m.scheduledAt.toISOString(),
    location: m.location,
    onlineUrl: m.onlineUrl,
    status: m.status,
    outcomeNotes: m.outcomeNotes,
  }));
}

/**
 * Calendar K1 — converts already-fetched TeacherMeetingRow[] (from
 * fetchMeetingsForTeacher()/fetchMeetingsForSchool(), called unmodified
 * above) into the shared CalendarItem projection, filtered to the
 * requested window. The filtering happens here, in application code,
 * rather than by adding a window parameter to fetchMeetingsForTeacher()
 * itself — that function's existing "all/upcoming/past" contract, and
 * every one of its existing callers (Teacher Today, both Meetings
 * pages), stays completely untouched.
 */
export function teacherMeetingRowsToCalendarItems(
  rows: TeacherMeetingRow[],
  schoolId: string,
  window: CalendarWindow
): CalendarItem[] {
  const from = new Date(`${window.from}T00:00:00+05:45`);
  const to = new Date(`${window.to}T23:59:59+05:45`);
  return rows
    .filter((m) => m.status === "SCHEDULED")
    .filter((m) => {
      const t = new Date(m.scheduledAt);
      return t >= from && t <= to;
    })
    .map((m) => {
      const instant = new Date(m.scheduledAt);
      return {
        id: `ParentTeacherMeeting:${m.id}`,
        title: `${m.subjectName ?? "General"} — ${m.teacherName}`,
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(instant),
        time: formatKathmanduTime(instant),
        isAllDay: false,
        category: "MEETING" as const,
        sourceType: "ParentTeacherMeeting" as const,
        sourceId: m.id,
        scopeType: "SCHOOL" as const,
        scopeId: schoolId,
        description: null,
        location: m.location,
        // /dashboard/meetings is Admin/Teacher-only (staff), and accepts
        // ?teacher= — every row already carries its own teacherId, so this
        // always lands on that specific teacher's meetings regardless of
        // whether the caller is the Admin's school-wide view or the
        // Teacher's own view.
        link: `/dashboard/meetings?teacher=${m.teacherId}`,
      };
    });
}

/**
 * Calendar K1 — same conversion for Parent's audience, over already-
 * fetched MeetingRow[] from fetchMeetingsForStudent() (called
 * unmodified). That function has no window parameter of its own
 * (always "last 20, any time"), so filtering to the requested window
 * happens here, exactly the same technique as the Teacher-side
 * converter above. `child`, when supplied, identifies which linked
 * child this meeting belongs to (Parent Calendar only) — Parent has no
 * access to /dashboard/meetings (staff-only), so no link is set here.
 */
export function parentMeetingRowsToCalendarItems(
  rows: MeetingRow[],
  schoolId: string,
  window: CalendarWindow,
  child?: { id: string; name: string }
): CalendarItem[] {
  const from = new Date(`${window.from}T00:00:00+05:45`);
  const to = new Date(`${window.to}T23:59:59+05:45`);
  return rows
    .filter((m) => m.status === "SCHEDULED")
    .filter((m) => {
      const t = new Date(m.scheduledAt);
      return t >= from && t <= to;
    })
    .map((m) => {
      const instant = new Date(m.scheduledAt);
      const baseTitle = `${m.subjectName ?? "General"} — ${m.teacherName}`;
      return {
        id: `ParentTeacherMeeting:${m.id}`,
        title: child ? `${child.name} — ${baseTitle}` : baseTitle,
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(instant),
        time: formatKathmanduTime(instant),
        isAllDay: false,
        category: "MEETING" as const,
        sourceType: "ParentTeacherMeeting" as const,
        sourceId: m.id,
        scopeType: "SCHOOL" as const,
        scopeId: schoolId,
        description: null,
        location: m.location,
        link: null,
        childId: child?.id,
        childName: child?.name,
      };
    });
}
