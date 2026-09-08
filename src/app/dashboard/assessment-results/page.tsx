import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveFrameworkAssignment } from "@/lib/assessmentFramework";
import { getAccessibleSchools, SCHOOL_CONTEXT_COOKIE } from "@/lib/institutionalContext";
import SchoolChooser from "@/components/SchoolChooser";

export const dynamic = "force-dynamic";

/**
 * Landing page: lists the subjects the caller may enter/publish
 * assessment results for this session — every subject at the school
 * for a School Admin, or only the Subject Teacher's own
 * TeacherAcademicAssignment subjects for a Teacher. Mirrors the
 * Academics list -> per-subject-detail pattern already used by
 * /dashboard/academics -> /dashboard/academics/[gradeSubjectId].
 */
export default async function AssessmentResultsLandingPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({ where: { userId }, include: { school: true } });
  const isAdmin = !!schoolAdmin;

  // Never resolved from the Teacher.schoolId bridge field, which can go
  // stale (see src/lib/affiliation.ts's syncTeacherBridgeFields doc
  // comment) — always re-derived from ACTIVE TeacherSchoolAffiliation
  // rows via getAccessibleSchools(), matching dashboard/page.tsx's own
  // Teacher-branch chooser behavior exactly (one school resolves
  // directly; 2+ shows a chooser, or resolves via a freshly-revalidated
  // cookie, never guessed).
  let schoolId: string;
  let teacher: { id: string } | null = null;
  if (isAdmin) {
    schoolId = schoolAdmin!.school.id;
  } else {
    const teacherSchools = (await getAccessibleSchools(userId)).filter((s) => s.role === "TEACHER");
    if (teacherSchools.length === 0) redirect("/dashboard");
    if (teacherSchools.length === 1) {
      schoolId = teacherSchools[0].schoolId;
    } else {
      const cookieSchoolId = cookies().get(SCHOOL_CONTEXT_COOKIE)?.value;
      const match = cookieSchoolId && teacherSchools.find((s) => s.schoolId === cookieSchoolId);
      if (match) {
        schoolId = match.schoolId;
      } else {
        return (
          <SchoolChooser
            schools={teacherSchools}
            userName={session?.user?.name || "there"}
            redirectTo="/dashboard/assessment-results"
          />
        );
      }
    }
    teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) redirect("/dashboard");
  }

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Assessment Results</h1>
        <p className="text-slate-500 text-sm">No active academic session at this school.</p>
      </div>
    );
  }

  let gradeSubjects;
  if (isAdmin) {
    gradeSubjects = await prisma.gradeSubject.findMany({
      where: { academicSessionId: activeSession.id, schoolGrade: { schoolId } },
      include: { subject: true, schoolGrade: true },
      orderBy: [{ schoolGrade: { gradeReference: { order: "asc" } } }, { subject: { name: "asc" } }],
    });
  } else {
    const assignments = await prisma.teacherAcademicAssignment.findMany({
      where: { teacherId: teacher!.id, academicSessionId: activeSession.id },
      include: { gradeSubject: { include: { subject: true, schoolGrade: true } } },
      distinct: ["gradeSubjectId"],
    });
    gradeSubjects = assignments.map((a) => a.gradeSubject);
  }

  const rows = await Promise.all(
    gradeSubjects.map(async (gs) => {
      const assignment = await resolveFrameworkAssignment({
        academicSessionId: activeSession.id,
        schoolGradeId: gs.schoolGradeId,
        gradeSubjectId: gs.id,
      });
      return {
        gradeSubjectId: gs.id,
        gradeName: gs.schoolGrade.displayName,
        subjectName: gs.subject.name,
        frameworkName: assignment?.framework.name ?? null,
      };
    })
  );

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Assessment Results</h1>
      <p className="text-sm text-slate-500 mb-8">{activeSession.name}</p>

      {rows.length === 0 ? (
        <p className="text-slate-400 text-sm">
          {isAdmin ? "No subjects offered this session yet." : "No subjects assigned to you this session."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.gradeSubjectId}
              href={`/dashboard/assessment-results/${r.gradeSubjectId}`}
              className="block border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-mega-navy transition"
            >
              {r.gradeName} — {r.subjectName}
              <span className="text-slate-400">
                {" "}
                — {r.frameworkName ?? "No framework assigned"}
              </span>
              <span className="text-mega-blue"> — Enter results →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
