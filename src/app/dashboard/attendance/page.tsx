import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AttendanceClient from "./AttendanceClient";

export const dynamic = "force-dynamic";

type GradeOption = {
  id: string;
  displayName: string;
  wholeGradeAllowed: boolean;
  sections: { id: string; name: string }[];
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { grade?: string; section?: string; date?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({ where: { userId }, include: { school: true } });
  const teacher = schoolAdmin ? null : await prisma.teacher.findUnique({ where: { userId } });
  if (!schoolAdmin && !teacher?.schoolId) redirect("/dashboard");

  const schoolId = schoolAdmin ? schoolAdmin.school.id : (teacher!.schoolId as string);
  const isAdmin = !!schoolAdmin;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Attendance</h1>
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
      where: { teacherId: teacher!.id, academicSessionId: activeSession.id },
      include: { schoolGrade: { include: { sections: { where: { isActive: true }, orderBy: { name: "asc" } } } }, section: true },
    });
    const byGrade = new Map<string, GradeOption>();
    for (const a of assignments) {
      const existing = byGrade.get(a.schoolGradeId);
      if (a.sectionId === null) {
        // Grade-wide — covers every section, plus the whole-grade option.
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
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Attendance</h1>
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
  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = searchParams.date || today;

  const roster = await prisma.gradeHistory.findMany({
    where: {
      schoolGradeId: selectedGradeId,
      academicSessionId: activeSession.id,
      ...(selectedSectionId ? { sectionId: selectedSectionId } : {}),
    },
    include: { student: { include: { user: true } }, section: true },
    orderBy: { student: { user: { name: "asc" } } },
  });

  const parsedDate = new Date(selectedDate);
  const existingAttendance = !isNaN(parsedDate.getTime())
    ? await prisma.attendance.findMany({
        where: { studentId: { in: roster.map((r) => r.studentId) }, date: parsedDate },
      })
    : [];
  const attendanceByStudent = new Map(existingAttendance.map((a) => [a.studentId, a]));

  return (
    <AttendanceClient
      schoolId={schoolId}
      academicSessionId={activeSession.id}
      gradeOptions={gradeOptions.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        wholeGradeAllowed: g.wholeGradeAllowed,
        sections: g.sections,
      }))}
      selectedGradeId={selectedGradeId}
      selectedSectionId={selectedSectionId}
      selectedDate={selectedDate}
      roster={roster.map((r) => {
        const existing = attendanceByStudent.get(r.studentId);
        return {
          studentId: r.studentId,
          studentName: r.student.fullName,
          avatarUrl: r.student.user?.avatarUrl ?? null,
          sectionName: r.section?.name ?? null,
          attendanceId: existing?.id ?? null,
          status: existing?.status ?? null,
          remarks: existing?.remarks ?? null,
        };
      })}
    />
  );
}
