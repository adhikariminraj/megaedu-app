import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import ParentDashboard from "./ParentDashboard";
import OrgDashboard from "./OrgDashboard";
import CreateSchoolPrompt from "./CreateSchoolPrompt";
import CreateOrgPrompt from "./CreateOrgPrompt";
import AccountantDashboard from "./AccountantDashboard";
import PlatformAdminDashboard from "./PlatformAdminDashboard";
import type { AttendanceRow, ProgressRow, TestResultRow, EvaluationRow } from "@/components/AcademicProgressPanel";

export const dynamic = "force-dynamic";

/**
 * The Phase 3B/3C academic summary (attendance, teaching progress, test
 * results, evaluations) for exactly one student — the sole place this
 * query shape is written, shared by the STUDENT branch (their own data)
 * and the PARENT branch (once per linked child) below, so the two can
 * never drift apart. Callers are responsible for only ever passing a
 * studentId they've already verified the caller is allowed to see —
 * this function itself does no authorization.
 *
 * `audience` controls which StudentEvaluation rows come back:
 * "STUDENT" filters on visibleToStudent, "PARENT" filters on
 * visibleToParent — the two are fully independent gates (a Student and
 * their Parent may legitimately see different evaluations), so this
 * function is always called once per intended audience, never shared
 * between a Student's own view and a Parent's view of that same child.
 */
async function fetchAcademicProgress(
  studentId: string,
  audience: "STUDENT" | "PARENT"
): Promise<{
  attendance: AttendanceRow[];
  teachingProgress: ProgressRow[];
  testResults: TestResultRow[];
  evaluations: EvaluationRow[];
}> {
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
      where: {
        studentId,
        ...(audience === "STUDENT" ? { visibleToStudent: true } : { visibleToParent: true }),
      },
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

/**
 * ParentTeacherMeeting read data for exactly one student — called ONLY
 * from the PARENT branch below. Deliberately NOT part of
 * fetchAcademicProgress() and NOT called from the STUDENT branch at
 * all: Students have no PTM visibility in this phase (see
 * PRODUCT_RULES.md) — kept as a structurally separate code path, not
 * just a hidden UI section, so there's no query result a Student's own
 * page could ever accidentally render.
 */
async function fetchParentMeetings(studentId: string) {
  const meetings = await prisma.parentTeacherMeeting.findMany({
    where: { studentId },
    include: { teacher: { include: { user: true } }, gradeSubject: { include: { subject: true } } },
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
  }));
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const roles = (session.user as any).roles as string[];
  const userName = session.user.name || "there";

  // Platform Admin gets its own dedicated command center, checked first
  // since it's a distinct operational surface rather than part of the
  // school/org/teacher/student priority chain below.
  if (roles?.includes("PLATFORM_ADMIN")) {
    const [
      schoolTotal,
      schoolVerified,
      schoolActive,
      schoolPending,
      pendingSchools,
      orgTotal,
      orgVerified,
      orgActive,
      orgPending,
      pendingOrganizations,
      teacherTotal,
      teacherApproved,
      studentTotal,
      studentApproved,
      courseTotal,
      coursePublished,
      certificateTotal,
      userTotal,
      roleCounts,
    ] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { verified: true } }),
      prisma.school.count({ where: { isActive: true } }),
      prisma.school.count({ where: { verified: false } }),
      prisma.school.findMany({
        where: { verified: false },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: { admins: { include: { user: true }, take: 1 } },
      }),
      prisma.organization.count(),
      prisma.organization.count({ where: { verified: true } }),
      prisma.organization.count({ where: { isActive: true } }),
      prisma.organization.count({ where: { verified: false } }),
      prisma.organization.findMany({
        where: { verified: false },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: { admins: { include: { user: true }, take: 1 } },
      }),
      prisma.teacher.count(),
      prisma.teacher.count({ where: { approved: true } }),
      prisma.student.count(),
      prisma.student.count({ where: { approved: true } }),
      prisma.course.count(),
      prisma.course.count({ where: { published: true } }),
      prisma.certificate.count(),
      prisma.user.count(),
      prisma.userRole.groupBy({ by: ["role"], _count: { role: true } }),
    ]);

    return (
      <PlatformAdminDashboard
        userName={userName}
        stats={{
          schools: { total: schoolTotal, verified: schoolVerified, pending: schoolPending, active: schoolActive },
          organizations: { total: orgTotal, verified: orgVerified, pending: orgPending, active: orgActive },
          teachers: { total: teacherTotal, approved: teacherApproved, pending: teacherTotal - teacherApproved },
          students: { total: studentTotal, approved: studentApproved, pending: studentTotal - studentApproved },
          courses: { total: courseTotal, published: coursePublished, unpublished: courseTotal - coursePublished },
          certificates: { total: certificateTotal },
          users: {
            total: userTotal,
            byRole: roleCounts.map((r) => ({ role: r.role, count: r._count.role })),
          },
        }}
        pendingSchools={pendingSchools}
        pendingOrganizations={pendingOrganizations}
      />
    );
  }

  // A MEGA ID can hold multiple roles — check School Admin first since
  // that's the most feature-complete dashboard, then fall back through
  // the others. This is a simple MVP priority order, not a permission
  // hierarchy.
  if (roles?.includes("SCHOOL_ADMIN")) {
    const schoolAdmin = await prisma.schoolAdmin.findFirst({
      where: { userId },
      include: {
        school: {
          include: {
            programs: true,
            news: true,
            events: true,
            opportunities: { orderBy: { createdAt: "desc" } },
            teachers: { include: { user: true }, orderBy: { createdAt: "desc" } },
            students: { include: { user: true }, orderBy: { createdAt: "desc" } },
            accountants: { include: { user: true } },
          },
        },
      },
    });
    if (schoolAdmin) {
      const schoolId = schoolAdmin.school.id;
      const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

      const schoolGrades = await prisma.schoolGrade.findMany({
        where: { schoolId },
        include: {
          gradeReference: true,
          sections: { where: { isActive: true }, orderBy: { name: "asc" } },
        },
        orderBy: { gradeReference: { order: "asc" } },
      });

      let placementByStudentId: Record<
        string,
        { gradeHistoryId: string; schoolGradeId: string; gradeDisplayName: string; sectionId: string | null; sectionName: string | null }
      > = {};
      if (activeSession) {
        const placements = await prisma.gradeHistory.findMany({
          where: {
            studentId: { in: schoolAdmin.school.students.map((s) => s.id) },
            academicSessionId: activeSession.id,
          },
          include: { schoolGrade: true, section: true },
        });
        placementByStudentId = Object.fromEntries(
          placements.map((p) => [
            p.studentId,
            {
              gradeHistoryId: p.id,
              schoolGradeId: p.schoolGradeId,
              gradeDisplayName: p.schoolGrade.displayName,
              sectionId: p.sectionId,
              sectionName: p.section?.name ?? null,
            },
          ])
        );
      }

      return (
        <DashboardClient
          school={{
            ...schoolAdmin.school,
            students: schoolAdmin.school.students.map((s) => ({
              ...s,
              placement: placementByStudentId[s.id] ?? null,
            })),
          }}
          userName={userName}
          activeSession={activeSession ? { id: activeSession.id, name: activeSession.name } : null}
          schoolGrades={schoolGrades.map((g) => ({
            id: g.id,
            displayName: g.displayName,
            sections: g.sections.map((sec) => ({ id: sec.id, name: sec.name })),
          }))}
        />
      );
    }
    return <CreateSchoolPrompt userName={userName} />;
  }

  if (roles?.includes("TEACHER")) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        school: true,
        user: { include: { interests: { orderBy: { createdAt: "desc" } } } },
        courseEnrollments: { include: { course: true, certificate: true } },
        academicAssignments: {
          where: { academicSession: { status: "ACTIVE" } },
          include: { schoolGrade: true, section: true, subject: true, gradeSubject: true },
          orderBy: [{ schoolGrade: { gradeReference: { order: "asc" } } }, { subject: { name: "asc" } }],
        },
        classTeacherAssignments: {
          where: { academicSession: { status: "ACTIVE" } },
          include: { schoolGrade: true, section: true },
          orderBy: { schoolGrade: { gradeReference: { order: "asc" } } },
        },
      },
    });
    if (teacher) return <TeacherDashboard teacher={teacher} userName={userName} />;
  }

  if (roles?.includes("STUDENT")) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        school: true,
        user: { include: { interests: { orderBy: { createdAt: "desc" } } } },
        courseEnrollments: { include: { course: true, certificate: true } },
        skills: { include: { addedBy: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (student) {
      const progress = await fetchAcademicProgress(student.id, "STUDENT");
      let interestsLocked = false;
      if (student.schoolId) {
        const activeSession = await prisma.academicSession.findFirst({
          where: { schoolId: student.schoolId, status: "ACTIVE" },
          select: { id: true },
        });
        interestsLocked = !!(activeSession && student.interestsLockedForSessionId === activeSession.id);
      }
      return (
        <StudentDashboard
          student={student}
          userName={userName}
          attendance={progress.attendance}
          teachingProgress={progress.teachingProgress}
          testResults={progress.testResults}
          evaluations={progress.evaluations}
          interestsLocked={interestsLocked}
        />
      );
    }
  }

  if (roles?.includes("PARENT")) {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { children: { include: { student: { include: { user: true, school: true } } } } },
    });
    if (parent) {
      // childStudentIds is derived ENTIRELY from the logged-in parent's
      // own resolved ParentStudent rows above — never from a request
      // parameter or any other client-supplied value. Each child's
      // progress is then fetched individually by that server-derived
      // id, so one child's data can never leak into another's.
      const childrenWithProgress = await Promise.all(
        parent.children.map(async (c) => ({
          ...c,
          progress: await fetchAcademicProgress(c.student.id, "PARENT"),
          meetings: await fetchParentMeetings(c.student.id),
        }))
      );
      return <ParentDashboard parent={{ ...parent, children: childrenWithProgress }} userName={userName} />;
    }
  }

  if (roles?.includes("ORGANIZATION_ADMIN")) {
    const orgAdmin = await prisma.organizationAdmin.findFirst({
      where: { userId },
      include: {
        organization: {
          include: {
            courses: { include: { approach: true }, orderBy: { createdAt: "desc" } },
            opportunities: { orderBy: { createdAt: "desc" } },
            accountants: { include: { user: true } },
          },
        },
      },
    });
    if (orgAdmin) return <OrgDashboard organization={orgAdmin.organization} userName={userName} />;
    return <CreateOrgPrompt userName={userName} />;
  }

  if (roles?.includes("ACCOUNTANT")) {
    const [schoolLinks, orgLinks] = await Promise.all([
      prisma.schoolAccountant.findMany({ where: { userId }, include: { school: true } }),
      prisma.organizationAccountant.findMany({ where: { userId }, include: { organization: true } }),
    ]);
    if (schoolLinks.length > 0 || orgLinks.length > 0) {
      return <AccountantDashboard userName={userName} schoolLinks={schoolLinks} orgLinks={orgLinks} />;
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome to MEGA.EDU</h1>
      <p className="text-slate-500">
        Your MEGA ID isn&apos;t linked to a school, teacher, student, or parent
        profile yet.
      </p>
    </div>
  );
}
