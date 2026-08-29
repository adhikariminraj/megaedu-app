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

export const dynamic = "force-dynamic";

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
    if (schoolAdmin) return <DashboardClient school={schoolAdmin.school} userName={userName} />;
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
      const [recentAttendance, currentPlacement, testResults] = await Promise.all([
        prisma.attendance.findMany({
          where: { studentId: student.id },
          orderBy: { date: "desc" },
          take: 15,
        }),
        prisma.gradeHistory.findFirst({
          where: { studentId: student.id, academicSession: { status: "ACTIVE" } },
          include: { schoolGrade: true, section: true },
        }),
        prisma.unitTestResult.findMany({
          where: { studentId: student.id },
          include: { unitTest: { include: { unit: { include: { subject: true } } } } },
          orderBy: { unitTest: { testDate: "desc" } },
          take: 20,
        }),
      ]);

      let teachingProgress: {
        subjectName: string;
        total: number;
        completed: number;
        inProgress: number;
      }[] = [];
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

      return (
        <StudentDashboard
          student={student}
          userName={userName}
          attendance={recentAttendance.map((a) => ({
            date: a.date.toISOString().slice(0, 10),
            status: a.status,
            remarks: a.remarks,
          }))}
          teachingProgress={teachingProgress}
          testResults={testResults.map((r) => ({
            id: r.id,
            testTitle: r.unitTest.title,
            unitTitle: r.unitTest.unit.title,
            subjectName: r.unitTest.unit.subject.name,
            testDate: r.unitTest.testDate.toISOString().slice(0, 10),
            maxMarks: r.unitTest.maxMarks,
            status: r.status,
            marksObtained: r.marksObtained,
            remarks: r.remarks,
          }))}
        />
      );
    }
  }

  if (roles?.includes("PARENT")) {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { children: { include: { student: { include: { user: true, school: true } } } } },
    });
    if (parent) return <ParentDashboard parent={parent} userName={userName} />;
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
