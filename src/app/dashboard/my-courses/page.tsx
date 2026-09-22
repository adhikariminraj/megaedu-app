import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Whole-Ecosystem Refinement E — a role-agnostic Academy learner surface.
 * CourseEnrollment.userId is the authoritative learner identity (see the
 * doc comment on the CourseEnrollment model): any authenticated MEGA ID
 * may hold enrollments, not only a Student or Teacher profile. Student/
 * Teacher dashboards already show their own enrollments inline, so this
 * page isn't duplicated there — it exists specifically so a Parent,
 * School Admin, School Accountant, Organization Admin, Organization
 * Accountant, or an otherwise-unaffiliated authenticated user has
 * somewhere to see courses they personally enrolled in. Scoped to the
 * caller's own userId only — never a route param, so one user's
 * enrollments can never leak into another's.
 */
export default async function MyCoursesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const enrollments = await prisma.courseEnrollment.findMany({
    where: { userId },
    include: {
      course: { include: { organization: true } },
      certificate: true,
    },
    orderBy: { enrolledAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">My Courses</h1>
      <p className="text-slate-500 text-sm mb-8">Your MEGA Academy enrollments.</p>

      {enrollments.length === 0 ? (
        <div className="border border-slate-200 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm mb-4">You haven&apos;t enrolled in any courses yet.</p>
          <Link href="/courses" className="text-mega-blue font-semibold text-sm">
            Browse MEGA Academy →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between border border-slate-200 rounded-xl p-4"
            >
              <div>
                <p className="font-medium text-slate-800">{e.course.title}</p>
                <p className="text-xs text-slate-400">
                  {e.course.organization?.name ?? "MEGA.EDU"}
                  {" · "}
                  {e.certificate ? "Completed" : `${e.progress}% complete`}
                </p>
                {e.certificate && (
                  <Link
                    href={`/dashboard/certificates/${e.certificate.id}/preview`}
                    className="text-xs text-mega-blue"
                  >
                    View certificate →
                  </Link>
                )}
              </div>
              <Link href={`/courses/${e.course.slug}/learn`} className="text-sm font-semibold text-mega-navy">
                {e.certificate ? "Review" : "Continue"} →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
