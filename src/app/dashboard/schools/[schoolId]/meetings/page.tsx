import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import MeetingsClient from "../../../meetings/MeetingsClient";

export const dynamic = "force-dynamic";

/**
 * Phase 4D-3 proof-of-context: identical to /dashboard/meetings in
 * every respect except how schoolId/isAdmin/teacher are resolved —
 * here via verifySchoolAccess(params.schoolId), the real,
 * fresh-every-request gate, instead of the old
 * schoolAdmin.findFirst()/Teacher.schoolId bridge lookup. Same
 * pattern as the Attendance/Evaluations proofs-of-concept. Renders
 * the same MeetingsClient (with its own scoped basePath so in-page
 * filter changes stay under this URL) and posts to the same
 * /api/schools/[id]/meetings(/[meetingId]) routes, whose own teacher
 * resolution was updated in this same phase to check an ACTIVE
 * TeacherSchoolAffiliation rather than the bridge field.
 */
export default async function ScopedMeetingsPage({
  params,
  searchParams,
}: {
  params: { schoolId: string };
  searchParams: { teacher?: string; status?: string; when?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access) redirect("/dashboard");

  const schoolId = params.schoolId;
  const isAdmin = access.role === "SCHOOL_ADMIN";
  const myTeacherId = access.role === "TEACHER" ? access.teacherId : null;

  const statusFilter =
    searchParams.status && ["SCHEDULED", "COMPLETED", "CANCELLED"].includes(searchParams.status)
      ? searchParams.status
      : null;
  const whenFilter = searchParams.when === "upcoming" || searchParams.when === "past" ? searchParams.when : "all";
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
      basePath={`/dashboard/schools/${schoolId}/meetings`}
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
