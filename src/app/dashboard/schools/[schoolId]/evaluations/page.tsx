import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import EvaluationsClient from "../../../evaluations/EvaluationsClient";

export const dynamic = "force-dynamic";

type GradeOption = {
  id: string;
  displayName: string;
  wholeGradeAllowed: boolean;
  sections: { id: string; name: string }[];
};

/**
 * Phase 4D-2 proof-of-context: identical to /dashboard/evaluations in
 * every respect except how schoolId/isAdmin/teacher are resolved —
 * here via verifySchoolAccess(params.schoolId), the real,
 * fresh-every-request gate, instead of the old
 * schoolAdmin.findFirst()/Teacher.schoolId bridge lookup. Same pattern
 * as the Attendance proof-of-concept from Phase 4D-1. Renders the
 * same EvaluationsClient and posts to the same, unmodified evaluation
 * API routes as the existing page.
 */
export default async function ScopedEvaluationsPage({
  params,
  searchParams,
}: {
  params: { schoolId: string };
  searchParams: { grade?: string; section?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access) redirect("/dashboard");

  const schoolId = params.schoolId;
  const isAdmin = access.role === "SCHOOL_ADMIN";
  const teacherId = access.role === "TEACHER" ? access.teacherId : null;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">General Student Evaluation</h1>
        <p className="text-slate-500 text-sm">No active academic session yet.</p>
      </div>
    );
  }

  let gradeOptions: GradeOption[] = [];
  if (isAdmin) {
    const grades = await prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true, sections: { where: { isActive: true }, orderBy: { name: "asc" } } },
      orderBy: { gradeReference: { order: "asc" } },
    });
    gradeOptions = grades.map((g) => ({
      id: g.id,
      displayName: g.displayName,
      wholeGradeAllowed: true,
      sections: g.sections.map((s) => ({ id: s.id, name: s.name })),
    }));
  } else {
    const assignments = await prisma.classTeacherAssignment.findMany({
      where: { teacherId: teacherId!, academicSessionId: activeSession.id },
      include: { schoolGrade: { include: { sections: { where: { isActive: true }, orderBy: { name: "asc" } } } }, section: true },
    });
    const byGrade = new Map<string, GradeOption>();
    for (const a of assignments) {
      const existing = byGrade.get(a.schoolGradeId);
      if (a.sectionId === null) {
        byGrade.set(a.schoolGradeId, {
          id: a.schoolGradeId,
          displayName: a.schoolGrade.displayName,
          wholeGradeAllowed: true,
          sections: a.schoolGrade.sections.map((s) => ({ id: s.id, name: s.name })),
        });
      } else if (!existing) {
        byGrade.set(a.schoolGradeId, {
          id: a.schoolGradeId,
          displayName: a.schoolGrade.displayName,
          wholeGradeAllowed: false,
          sections: [{ id: a.sectionId, name: a.section!.name }],
        });
      } else if (!existing.wholeGradeAllowed) {
        existing.sections.push({ id: a.sectionId, name: a.section!.name });
      }
    }
    gradeOptions = [...byGrade.values()];
  }

  if (gradeOptions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">General Student Evaluation</h1>
        <p className="text-slate-500 text-sm">
          {isAdmin
            ? "No grades configured yet."
            : "You aren't assigned as a Grade Coordinator or Class Teacher for any grade this session."}
        </p>
      </div>
    );
  }

  const selectedGradeId = searchParams.grade && gradeOptions.some((g) => g.id === searchParams.grade)
    ? searchParams.grade
    : gradeOptions[0].id;
  const selectedGrade = gradeOptions.find((g) => g.id === selectedGradeId)!;
  const selectedSectionId = searchParams.section && selectedGrade.sections.some((s) => s.id === searchParams.section)
    ? searchParams.section
    : null;

  const roster = await prisma.gradeHistory.findMany({
    where: {
      schoolGradeId: selectedGradeId,
      academicSessionId: activeSession.id,
      ...(selectedSectionId ? { sectionId: selectedSectionId } : {}),
    },
    include: { student: { include: { user: true } }, section: true },
    orderBy: { student: { user: { name: "asc" } } },
  });

  // For a School Admin creating an evaluation "on behalf of" a teacher —
  // only Grade Coordinators/Class Teachers actually eligible for this exact scope.
  const classTeachers = isAdmin
    ? await prisma.classTeacherAssignment.findMany({
        where: {
          schoolGradeId: selectedGradeId,
          academicSessionId: activeSession.id,
          OR: [{ sectionId: null }, { sectionId: selectedSectionId }],
        },
        include: { teacher: { include: { user: true } } },
      })
    : [];

  const evaluations = await prisma.studentEvaluation.findMany({
    where: {
      studentId: { in: roster.map((r) => r.studentId) },
      academicSessionId: activeSession.id,
      gradeSubjectId: null,
    },
    include: { teacher: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });
  const evaluationsByStudent = new Map<string, typeof evaluations>();
  for (const ev of evaluations) {
    const list = evaluationsByStudent.get(ev.studentId) ?? [];
    list.push(ev);
    evaluationsByStudent.set(ev.studentId, list);
  }

  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: { studentId: { in: roster.map((r) => r.studentId) }, gradeSubjectId: null },
    include: { teacher: { include: { user: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  const meetingsByStudent = new Map<string, typeof meetings>();
  for (const m of meetings) {
    const list = meetingsByStudent.get(m.studentId) ?? [];
    list.push(m);
    meetingsByStudent.set(m.studentId, list);
  }

  return (
    <EvaluationsClient
      schoolId={schoolId}
      isAdmin={isAdmin}
      myTeacherId={teacherId}
      classTeacherOptions={classTeachers.map((c) => ({ id: c.teacherId, name: c.teacher.fullName }))}
      gradeOptions={gradeOptions}
      selectedGradeId={selectedGradeId}
      selectedSectionId={selectedSectionId}
      roster={roster.map((r) => ({
        studentId: r.studentId,
        studentName: r.student.fullName,
        sectionName: r.section?.name ?? null,
        evaluations: (evaluationsByStudent.get(r.studentId) ?? []).map((ev) => ({
          id: ev.id,
          teacherId: ev.teacherId,
          teacherName: ev.teacher.fullName,
          remarks: ev.remarks,
          visibleToParent: ev.visibleToParent,
          visibleToStudent: ev.visibleToStudent,
        })),
        meetings: (meetingsByStudent.get(r.studentId) ?? []).map((m) => ({
          id: m.id,
          teacherId: m.teacherId,
          teacherName: m.teacher.fullName,
          scheduledAt: m.scheduledAt.toISOString(),
          location: m.location,
          onlineUrl: m.onlineUrl,
          status: m.status,
          outcomeNotes: m.outcomeNotes,
        })),
      }))}
    />
  );
}
