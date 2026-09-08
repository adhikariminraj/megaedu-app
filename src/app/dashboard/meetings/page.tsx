import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchMeetingsForTeacher, type TeacherMeetingRow } from "@/lib/academicProgress";
import { getAccessibleSchools } from "@/lib/institutionalContext";
import MeetingsClient from "./MeetingsClient";

export const dynamic = "force-dynamic";

/**
 * Cross-cutting Parent-Teacher Meeting management/history view —
 * unlike /dashboard/evaluations and /dashboard/academics/[gradeSubjectId]
 * (both roster-first, one grade/section at a time), this page queries
 * ParentTeacherMeeting directly: role-aware, not grade/section-scoped.
 * A Teacher sees only their own meetings (hard-filtered at the query
 * level, not just hidden in the UI); a School Admin sees every meeting
 * at their school, filterable by teacher/status/upcoming-vs-past.
 */
export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: { teacher?: string; status?: string; when?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({ where: { userId }, include: { school: true } });
  const isAdmin = !!schoolAdmin;

  // Never resolved from the Teacher.schoolId/approved bridge fields,
  // which can go stale (see src/lib/affiliation.ts's
  // syncTeacherBridgeFields doc comment) — always re-derived from
  // ACTIVE TeacherSchoolAffiliation rows via getAccessibleSchools(),
  // matching this page's already-correct sibling
  // (dashboard/schools/[schoolId]/meetings/page.tsx). This unscoped
  // page has no per-teacher chooser UI of its own, so a teacher with
  // 2+ ACTIVE schools is sent to /dashboard, whose own Teacher branch
  // already implements the real chooser — never guessed here.
  let schoolId: string;
  let myTeacherId: string | null = null;
  if (isAdmin) {
    schoolId = schoolAdmin!.school.id;
  } else {
    const teacherSchools = (await getAccessibleSchools(userId)).filter((s) => s.role === "TEACHER");
    if (teacherSchools.length === 0) redirect("/dashboard");
    if (teacherSchools.length > 1) redirect("/dashboard");
    schoolId = teacherSchools[0].schoolId;
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) redirect("/dashboard");
    myTeacherId = teacher.id;
  }

  const statusFilter =
    searchParams.status && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(searchParams.status)
      ? searchParams.status
      : null;
  const whenFilter = searchParams.when === "upcoming" || searchParams.when === "past" ? searchParams.when : "all";
  // Only an Admin may filter by an arbitrary teacher — a Teacher's own
  // results are already hard-scoped to themselves at the query level
  // below, regardless of any teacher= param they might pass.
  const teacherFilter = isAdmin && searchParams.teacher ? searchParams.teacher : null;

  // Admin keeps its own inline query (arbitrary/optional teacherFilter,
  // never just "one teacher's own meetings") — Teacher's branch is
  // exactly what fetchMeetingsForTeacher() now centralizes, reused
  // identically by the URL-scoped Meetings page and the Teacher Today
  // panel. Same where/include/orderBy shape as before this change, just
  // relocated for the non-admin case.
  const meetingRows: TeacherMeetingRow[] = isAdmin
    ? (
        await prisma.parentTeacherMeeting.findMany({
          where: {
            schoolId,
            ...(teacherFilter ? { teacherId: teacherFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(whenFilter === "upcoming" ? { scheduledAt: { gte: new Date() } } : {}),
            ...(whenFilter === "past" ? { scheduledAt: { lt: new Date() } } : {}),
          },
          include: {
            teacher: { include: { user: true } },
            student: { include: { user: true } },
            gradeSubject: { include: { subject: true } },
          },
          orderBy: { scheduledAt: whenFilter === "past" ? "desc" : "asc" },
        })
      ).map((m) => ({
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
      }))
    : await fetchMeetingsForTeacher(myTeacherId!, schoolId, { status: statusFilter, when: whenFilter });

  // Batch-fetch every distinct student's evaluations (unfiltered — this
  // is a staff view) so each meeting's "link a prepared evaluation"
  // dropdown has real options, without a query per row.
  const studentIds = [...new Set(meetingRows.map((m) => m.studentId))];
  const evaluations = studentIds.length
    ? await prisma.studentEvaluation.findMany({
        where: { studentId: { in: studentIds } },
        include: { teacher: { include: { user: true } } },
      })
    : [];
  const evaluationsByStudent = new Map<string, { id: string; teacherName: string; remarks: string }[]>();
  for (const ev of evaluations) {
    const list = evaluationsByStudent.get(ev.studentId) ?? [];
    list.push({ id: ev.id, teacherName: ev.teacher.fullName, remarks: ev.remarks });
    evaluationsByStudent.set(ev.studentId, list);
  }

  // Phase 4A: membership sourced from TeacherSchoolAffiliation (ACTIVE
  // only), not the Teacher.schoolId/approved bridge fields.
  const teacherOptions = isAdmin
    ? await prisma.teacherSchoolAffiliation
        .findMany({
          where: { schoolId, status: "ACTIVE" },
          include: { teacher: true },
          orderBy: { teacher: { fullName: "asc" } },
        })
        .then((affs) => affs.map((a) => a.teacher))
    : [];

  return (
    <MeetingsClient
      schoolId={schoolId}
      isAdmin={isAdmin}
      myTeacherId={myTeacherId}
      teacherOptions={teacherOptions.map((t) => ({ id: t.id, name: t.fullName }))}
      selectedTeacherId={teacherFilter}
      selectedStatus={statusFilter}
      selectedWhen={whenFilter}
      meetings={meetingRows.map((m) => ({
        ...m,
        evaluationOptions: evaluationsByStudent.get(m.studentId) ?? [],
      }))}
    />
  );
}
