import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";

export const dynamic = "force-dynamic";

/**
 * Lists every academic session for which this student has a currently-
 * ISSUED Mark Sheet — the owner-facing index, one level above the full
 * document view (/dashboard/mark-sheet/[studentId]/[markSheetId]).
 *
 * Access mirrors /dashboard/report-card/[studentId]/page.tsx exactly:
 * the Student themselves, a Parent linked to this student (via
 * ParentStudent, never a client-supplied id), or staff (School Admin /
 * any approved Teacher at the student's school). An unpublished/
 * not-yet-issued session correctly shows nothing here — only rows with
 * status "ISSUED" (the current version) are listed; superseded versions
 * remain reachable from the document view itself, not from this index.
 */
export default async function MarkSheetIndexPage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, userId: true, schoolId: true, fullName: true },
  });
  if (!student || !student.schoolId) notFound();

  let authorized = student.userId === userId;
  if (!authorized) {
    // Staff access never resolved from the Teacher.schoolId/approved
    // bridge fields, which can go stale (see src/lib/affiliation.ts's
    // syncTeacherBridgeFields doc comment) — verifySchoolAccess() re-
    // checks a fresh ACTIVE TeacherSchoolAffiliation (or a real
    // SchoolAdmin link) against this student's own current school.
    const [parentLink, access] = await Promise.all([
      prisma.parentStudent.findFirst({
        where: { studentId: student.id, parent: { userId }, confirmedAt: { not: null } },
      }),
      verifySchoolAccess(userId, student.schoolId),
    ]);
    authorized = !!(parentLink || access);
  }
  if (!authorized) redirect("/dashboard");

  const markSheets = await prisma.markSheet.findMany({
    where: { studentId: student.id, status: "ISSUED" },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Mark Sheets — {student.fullName}</h1>
      <p className="text-sm text-slate-500 mb-8">
        Formally issued annual academic results. For the current, day-to-day view, see the{" "}
        <Link href={`/dashboard/report-card/${student.id}`} className="text-mega-blue">
          Report Card
        </Link>
        .
      </p>

      {markSheets.length === 0 ? (
        <p className="text-sm text-slate-400">No Mark Sheet has been issued yet.</p>
      ) : (
        <div className="space-y-3">
          {markSheets.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/mark-sheet/${student.id}/${m.id}`}
              className="block border border-slate-200 rounded-xl p-4 hover:border-mega-blue"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{m.academicSessionNameSnapshot}</span>
                <span className="text-xs text-slate-400">Version {m.version}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {m.gradeDisplayNameSnapshot}
                {m.sectionNameSnapshot ? ` — Section ${m.sectionNameSnapshot}` : ""} · Issued{" "}
                {new Date(m.issuedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
