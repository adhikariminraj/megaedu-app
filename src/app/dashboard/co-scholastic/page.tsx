import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Landing page: lists the grades the caller may enter Co-Scholastic
 * results for this session — every grade at the school for a School
 * Admin, or only grades where the caller holds a ClassTeacherAssignment
 * for a Teacher (grade-wide or section-specific — either qualifies).
 * Mirrors /dashboard/assessment-results's own landing-page pattern.
 */
export default async function CoScholasticLandingPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const [schoolAdmin, teacher] = await Promise.all([
    prisma.schoolAdmin.findFirst({ where: { userId }, include: { school: true } }),
    prisma.teacher.findFirst({ where: { userId, approved: true } }),
  ]);
  const schoolId = schoolAdmin?.school.id ?? teacher?.schoolId;
  if (!schoolId) redirect("/dashboard");
  const isAdmin = !!schoolAdmin;

  const activeSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!activeSession) {
    return (
      <div className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Co-Scholastic</h1>
        <p className="text-slate-500 text-sm">No active academic session at this school.</p>
      </div>
    );
  }

  let grades;
  if (isAdmin) {
    grades = await prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    });
  } else {
    const assignments = await prisma.classTeacherAssignment.findMany({
      where: { teacherId: teacher!.id, academicSessionId: activeSession.id },
      include: { schoolGrade: { include: { gradeReference: true } } },
      distinct: ["schoolGradeId"],
    });
    grades = assignments.map((a) => a.schoolGrade);
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Co-Scholastic</h1>
      <p className="text-sm text-slate-500 mb-8">{activeSession.name}</p>

      {grades.length === 0 ? (
        <p className="text-slate-400 text-sm">
          {isAdmin ? "No grades configured yet." : "You aren't a Class Teacher for any grade this session."}
        </p>
      ) : (
        <div className="space-y-2">
          {grades.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/co-scholastic/${g.id}`}
              className="block border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-mega-navy transition"
            >
              {g.displayName} <span className="text-mega-blue">— Enter results →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
