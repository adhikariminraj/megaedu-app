import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessibleSchools, verifySchoolAccess } from "@/lib/institutionalContext";

export const dynamic = "force-dynamic";

/**
 * Phase 4D-1 — thin proof-of-context landing page. Deliberately not a
 * re-hosted DashboardClient/TeacherDashboard (that is full-dashboard
 * migration, explicitly out of scope for this phase); its only job is
 * to prove the URL-scoped context model end-to-end: confirms real,
 * live access to this exact school (never trusting how the URL was
 * reached), and offers the one migrated feature (Attendance) plus a
 * switcher back to any other currently-ACTIVE school.
 */
export default async function SchoolContextPage({ params }: { params: { schoolId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access) redirect("/dashboard");

  const [school, accessibleSchools] = await Promise.all([
    prisma.school.findUnique({ where: { id: params.schoolId }, select: { name: true } }),
    getAccessibleSchools(userId),
  ]);
  if (!school) redirect("/dashboard");

  const otherSchools = accessibleSchools.filter((s) => s.schoolId !== params.schoolId);

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <p className="text-sm text-slate-400 mb-1">You are working in</p>
      <h1 className="text-2xl font-bold text-slate-800 mb-8">{school.name}</h1>

      <Link
        href={`/dashboard/schools/${params.schoolId}/attendance`}
        className="block border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-mega-navy transition mb-4"
      >
        Attendance
        <span className="text-mega-blue"> — Take or review →</span>
      </Link>

      {access.role === "SCHOOL_ADMIN" && (
        <Link
          href={`/dashboard/schools/${params.schoolId}/inquiries`}
          className="block border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-mega-navy transition mb-8"
        >
          Inquiries
          <span className="text-mega-blue"> — Public visitor inquiries →</span>
        </Link>
      )}

      {otherSchools.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">Switch school</p>
          <div className="space-y-2">
            {otherSchools.map((s) => (
              <Link
                key={s.schoolId}
                href={`/dashboard/schools/${s.schoolId}`}
                className="block border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 hover:border-mega-navy transition"
              >
                {s.schoolName}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
