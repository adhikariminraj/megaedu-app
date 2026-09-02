import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const teacher = schoolAdmin ? null : await prisma.teacher.findFirst({ where: { userId, approved: true } });
  if (!schoolAdmin && !teacher?.schoolId) redirect("/dashboard");

  const schoolId = schoolAdmin ? schoolAdmin.school.id : (teacher!.schoolId as string);
  const isAdmin = !!schoolAdmin;
  const myTeacherId = teacher?.id ?? null;

  const statusFilter =
    searchParams.status && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(searchParams.status)
      ? searchParams.status
      : null;
  const whenFilter = searchParams.when === "upcoming" || searchParams.when === "past" ? searchParams.when : "all";
  // Only an Admin may filter by an arbitrary teacher — a Teacher's own
  // results are already hard-scoped to themselves at the query level
  // below, regardless of any teacher= param they might pass.
  const teacherFilter = isAdmin && searchParams.teacher ? searchParams.teacher : null;

  const now = new Date();
  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: {
      schoolId,
      ...(isAdmin ? (teacherFilter ? { teacherId: teacherFilter } : {}) : { teacherId: myTeacherId! }),
      ...(statusFilter ? { status: statusFilter } : {}),
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

  // Batch-fetch every distinct student's evaluations (unfiltered — this
  // is a staff view) so each meeting's "link a prepared evaluation"
  // dropdown has real options, without a query per row.
  const studentIds = [...new Set(meetings.map((m) => m.studentId))];
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

  const teacherOptions = isAdmin
    ? await prisma.teacher.findMany({
        where: { schoolId, approved: true },
        orderBy: { fullName: "asc" },
      })
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
      meetings={meetings.map((m) => ({
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
        evaluationOptions: evaluationsByStudent.get(m.studentId) ?? [],
      }))}
    />
  );
}
