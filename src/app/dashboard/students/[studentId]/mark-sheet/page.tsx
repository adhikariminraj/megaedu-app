import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkMarkSheetEligibility } from "@/lib/markSheet";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import MarkSheetIssuance from "./MarkSheetIssuance";

export const dynamic = "force-dynamic";

/**
 * School Admin management surface for one student's annual Mark Sheet —
 * the smallest useful UI for Phase 5/9: eligibility preview, Issue,
 * and Correct/reissue. Operates only against the school's currently
 * ACTIVE academic session (Mark Sheet V1 scope — see docs/MARK_SHEET.md);
 * issuing against a closed/past session is deferred.
 *
 * Access mirrors the Student Profile page exactly: School Admin gets
 * full control (Issue/Correct); an approved Teacher at the school can
 * view the same status read-only, consistent with how Student Profile
 * already treats Teacher as a read-only staff viewer.
 */
export default async function StudentMarkSheetPage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, fullName: true, schoolId: true },
  });
  if (!student || !student.schoolId) notFound();

  // Never resolved from the Teacher.schoolId/approved bridge fields,
  // which can go stale (see src/lib/affiliation.ts's
  // syncTeacherBridgeFields doc comment) — verifySchoolAccess() re-
  // checks a fresh ACTIVE TeacherSchoolAffiliation (or a real
  // SchoolAdmin link) against this student's own current school.
  const access = await verifySchoolAccess(userId, student.schoolId);
  if (!access) redirect("/dashboard");
  const isAdmin = access.role === "SCHOOL_ADMIN";

  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: student.schoolId, status: "ACTIVE" },
  });

  const [eligibility, versions] = await Promise.all([
    activeSession
      ? checkMarkSheetEligibility(student.id, student.schoolId, activeSession.id)
      : Promise.resolve({ eligible: false as const, reason: "This school has no active academic session." }),
    activeSession
      ? prisma.markSheet.findMany({
          where: { studentId: student.id, academicSessionId: activeSession.id },
          orderBy: { version: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">
        <Link href={`/dashboard/students/${student.id}`} className="text-mega-blue">
          ← {student.fullName}
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Annual Mark Sheet</h1>
      <p className="text-sm text-slate-500 mb-8">
        {activeSession ? activeSession.name : "No active academic session"} — the final, formally issued annual result.
        Different from the live{" "}
        <Link href={`/dashboard/report-card/${student.id}`} className="text-mega-blue">
          Report Card
        </Link>
        , which stays up to date all year; a Mark Sheet is issued once, at session end, and never silently changes.
      </p>

      <MarkSheetIssuance
        schoolId={student.schoolId}
        studentId={student.id}
        isAdmin={isAdmin}
        eligibility={eligibility}
        versions={versions.map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          issuedAt: v.issuedAt.toISOString(),
          issuerNameSnapshot: v.issuerNameSnapshot,
          correctionReason: v.correctionReason,
        }))}
      />
    </div>
  );
}
