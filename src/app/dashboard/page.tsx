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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;
  const roles = (session.user as any).roles as string[];
  const userName = session.user.name || "there";

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
          },
        },
      },
    });
    if (schoolAdmin) return <DashboardClient school={schoolAdmin.school} userName={userName} />;
    // Registered as a School Admin via the unified /register flow, but
    // hasn't created their school yet.
    return <CreateSchoolPrompt userName={userName} />;
  }

  if (roles?.includes("TEACHER")) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        school: true,
        user: true,
        courseEnrollments: { include: { course: true, certificate: true } },
      },
    });
    if (teacher) return <TeacherDashboard teacher={teacher} userName={userName} />;
  }

  if (roles?.includes("STUDENT")) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        school: true,
        user: true,
        courseEnrollments: { include: { course: true, certificate: true } },
      },
    });
    if (student) return <StudentDashboard student={student} userName={userName} />;
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
          },
        },
      },
    });
    if (orgAdmin) return <OrgDashboard organization={orgAdmin.organization} userName={userName} />;
    // Registered as an Organization Admin via the unified /register flow,
    // but hasn't created their organization yet.
    return <CreateOrgPrompt userName={userName} />;
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
