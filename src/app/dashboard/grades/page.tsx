import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findPendingStudents } from "@/lib/gradeRollover";
import { CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";
import { getAccessibleSchools, SCHOOL_CONTEXT_COOKIE } from "@/lib/institutionalContext";
import SchoolChooser from "@/components/SchoolChooser";
import PendingQueue from "./PendingQueue";

export const dynamic = "force-dynamic";

export default async function GradesIndexPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  // Phase 4D-4: institutional context resolved via getAccessibleSchools()
  // (ACTIVE School Admin links), never an arbitrary findFirst() pick —
  // authoritative even in the single-school case. 2+ schools require an
  // explicit choice (or a previously-chosen, freshly-revalidated cookie
  // preference), returned to this same /dashboard/grades URL rather
  // than a new route — there is no default "first" school.
  const adminSchools = (await getAccessibleSchools(userId)).filter((s) => s.role === "SCHOOL_ADMIN");
  if (adminSchools.length === 0) redirect("/dashboard");

  let resolvedSchoolId: string;
  if (adminSchools.length === 1) {
    resolvedSchoolId = adminSchools[0].schoolId;
  } else {
    const cookieSchoolId = cookies().get(SCHOOL_CONTEXT_COOKIE)?.value;
    const match = cookieSchoolId && adminSchools.find((s) => s.schoolId === cookieSchoolId);
    if (match) {
      resolvedSchoolId = match.schoolId;
    } else {
      return (
        <SchoolChooser
          schools={adminSchools}
          userName={session?.user?.name || "there"}
          redirectTo="/dashboard/grades"
        />
      );
    }
  }

  const schoolAdmin = await prisma.schoolAdmin.findUnique({
    where: { userId_schoolId: { userId, schoolId: resolvedSchoolId } },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

  const schoolGrades = await prisma.schoolGrade.findMany({
    where: { schoolId },
    include: { gradeReference: true },
    orderBy: { gradeReference: { order: "asc" } },
  });

  let enrolledCounts: Record<string, number> = {};
  if (activeSession) {
    const counts = await prisma.gradeHistory.groupBy({
      by: ["schoolGradeId"],
      where: { academicSessionId: activeSession.id, status: { in: CURRENT_ROSTER_STATUSES } },
      _count: { _all: true },
    });
    enrolledCounts = Object.fromEntries(counts.map((c) => [c.schoolGradeId, c._count._all]));
  }

  const pending = activeSession ? await findPendingStudents(schoolId, activeSession.id) : [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{schoolAdmin.school.name}</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Grades &amp; Promotion</h1>

      {!activeSession ? (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          No active academic session yet.{" "}
          <Link href="/dashboard/setup" className="underline font-medium">
            Complete Initial Setup
          </Link>{" "}
          first.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {activeSession.name} — open a grade to promote, repeat, transfer, or mark students as
              left. Each grade can be handled at its own pace, independently of the others.
            </p>
            <div className="flex gap-2 shrink-0">
              <Link
                href="/dashboard/academics"
                className="text-xs font-semibold text-mega-navy bg-blue-50 rounded-full px-3 py-1.5 hover:bg-blue-100 transition"
              >
                Subjects & Teachers →
              </Link>
              <Link
                href="/dashboard/sessions/new"
                className="text-xs font-semibold text-mega-navy bg-blue-50 rounded-full px-3 py-1.5 hover:bg-blue-100 transition"
              >
                Start New Session →
              </Link>
            </div>
          </div>

          {pending.length > 0 && (
            <PendingQueue
              schoolId={schoolId}
              activeSessionId={activeSession.id}
              activeSessionName={activeSession.name}
              schoolGrades={schoolGrades.map((g) => ({ id: g.id, displayName: g.displayName }))}
              pending={pending.map((p) => ({
                gradeHistoryId: p.id,
                studentId: p.studentId,
                studentName: p.student.fullName,
                fromGrade: p.schoolGrade.displayName,
                fromSessionName: p.academicSession.name,
                schoolGradeId: p.schoolGradeId,
                academicSessionId: p.academicSessionId,
              }))}
            />
          )}

          {schoolGrades.length === 0 ? (
            <p className="text-slate-400 text-sm">No grades configured yet.</p>
          ) : (
            <div className="space-y-3">
              {schoolGrades.map((g) => (
                <Link
                  key={g.id}
                  href={`/dashboard/grades/${g.id}`}
                  className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:shadow-md transition"
                >
                  <div>
                    <p className="font-medium text-slate-800">{g.displayName}</p>
                    <p className="text-xs text-slate-400">{g.gradeReference.code}</p>
                  </div>
                  <span className="text-xs font-semibold text-mega-navy bg-blue-50 rounded-full px-3 py-1">
                    {enrolledCounts[g.id] || 0} enrolled
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
