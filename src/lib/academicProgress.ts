import { prisma } from "@/lib/prisma";
import type { AttendanceRow, ProgressRow, TestResultRow, EvaluationRow } from "@/components/AcademicProgressPanel";

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
 */
export async function fetchAcademicProgress(
  studentId: string,
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
    prisma.gradeHistory.findFirst({
      where: { studentId, academicSession: { status: "ACTIVE" } },
      include: { schoolGrade: true, section: true },
    }),
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
      teacherName: ev.teacher.user.name,
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
    teacherName: m.teacher.user.name,
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
