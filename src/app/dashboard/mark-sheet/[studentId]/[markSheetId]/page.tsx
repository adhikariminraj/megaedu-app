import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OUTCOME_LABELS: Record<string, string> = {
  COMPLETED: "PROMOTED",
  REPEATED: "NOT PROMOTED — REPEATING",
  TRANSFERRED: "TRANSFERRED",
  LEFT: "LEFT THE SCHOOL",
};

/**
 * The formal, owner-facing Mark Sheet document view — one specific,
 * immutable version (current OR superseded; both remain permanently
 * viewable, per the versioning design in docs/MARK_SHEET.md).
 *
 * Every displayed value is read from this row's OWN *Snapshot fields,
 * never re-derived from live School/Student/GradeSubject data — a
 * later school rename, student name change, or subject rename must
 * never alter what's shown here. The one deliberate exception is the
 * school logo (looked up live via School.logoUrl), matching the exact
 * precedent already established by Certificate/CertificateDocument.
 *
 * No PDF — matches the Certificate preview's own deferred-PDF
 * precedent; this is a clean in-browser document view only.
 *
 * Access mirrors the Report Card / Mark Sheet index exactly: Student
 * (own), Parent (linked child, via ParentStudent), or school staff
 * (School Admin / approved Teacher at the ISSUING school — schoolId is
 * read from the MarkSheet row itself, not the student's CURRENT school,
 * so a School A staff member can still open a Mark Sheet School A
 * issued even if the student has since transferred to School B — see
 * PHASE 11 of the implementation this was built for).
 */
export default async function MarkSheetDocumentPage({
  params,
}: {
  params: { studentId: string; markSheetId: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const markSheet = await prisma.markSheet.findUnique({
    where: { id: params.markSheetId },
    include: {
      subjects: { orderBy: { order: "asc" } },
      school: { select: { logoUrl: true } },
    },
  });
  if (!markSheet || markSheet.studentId !== params.studentId) notFound();

  const student = await prisma.student.findUnique({
    where: { id: markSheet.studentId },
    select: { userId: true },
  });

  let authorized = student?.userId === userId;
  if (!authorized) {
    const [parentLink, schoolAdmin, teacher] = await Promise.all([
      prisma.parentStudent.findFirst({ where: { studentId: markSheet.studentId, parent: { userId } } }),
      prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: markSheet.schoolId } } }),
      prisma.teacher.findFirst({ where: { userId, schoolId: markSheet.schoolId, approved: true } }),
    ]);
    authorized = !!(parentLink || schoolAdmin || teacher);
  }
  if (!authorized) redirect("/dashboard");

  const outcomeLabel = OUTCOME_LABELS[markSheet.outcomeStatus] ?? markSheet.outcomeStatus;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 print:py-0">
      <p className="text-xs text-slate-400 mb-4 print:hidden">
        <Link href={`/dashboard/mark-sheet/${markSheet.studentId}`} className="text-mega-blue">
          ← All Mark Sheets
        </Link>
      </p>

      {markSheet.status === "SUPERSEDED" && (
        <div className="mb-4 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 print:hidden">
          SUPERSEDED — this version has been replaced by a later correction.
        </div>
      )}

      <div className="border-2 border-slate-800 rounded-2xl p-10">
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-300">
          <div className="flex items-center gap-3">
            {markSheet.school.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={markSheet.school.logoUrl} alt="" className="w-14 h-14 object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-800">{markSheet.schoolNameSnapshot}</h1>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Annual Academic Result — Mark Sheet</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Version {markSheet.version}</p>
            <p>{markSheet.academicSessionNameSnapshot}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Student</p>
            <p className="font-medium text-slate-800">{markSheet.studentNameSnapshot}</p>
          </div>
          {markSheet.studentMegaIdSnapshot && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">MEGA ID</p>
              <p className="font-mono text-xs text-slate-600">{markSheet.studentMegaIdSnapshot}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Grade / Year</p>
            <p className="font-medium text-slate-800">
              {markSheet.gradeDisplayNameSnapshot}
              {markSheet.sectionNameSnapshot ? ` — Section ${markSheet.sectionNameSnapshot}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Academic Session</p>
            <p className="font-medium text-slate-800">{markSheet.academicSessionNameSnapshot}</p>
          </div>
        </div>

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-left">
              <th className="py-2">Subject</th>
              <th className="py-2 text-right">Marks Obtained</th>
              <th className="py-2 text-right">Maximum Marks</th>
              {markSheet.subjects.some((s) => s.percentage !== null) && <th className="py-2 text-right">Percentage</th>}
              {markSheet.subjects.some((s) => s.gradeLabel) && <th className="py-2 text-right">Grade</th>}
              {markSheet.subjects.some((s) => s.gradePoint !== null) && <th className="py-2 text-right">Grade Point</th>}
            </tr>
          </thead>
          <tbody>
            {markSheet.subjects.map((s) => (
              <tr key={s.id} className="border-b border-slate-200">
                <td className="py-2">{s.subjectNameSnapshot}</td>
                <td className="py-2 text-right">{s.marksObtained}</td>
                <td className="py-2 text-right">{s.maximumMarks}</td>
                {markSheet.subjects.some((x) => x.percentage !== null) && (
                  <td className="py-2 text-right">{s.percentage !== null ? `${s.percentage.toFixed(1)}%` : "—"}</td>
                )}
                {markSheet.subjects.some((x) => x.gradeLabel) && <td className="py-2 text-right">{s.gradeLabel ?? "—"}</td>}
                {markSheet.subjects.some((x) => x.gradePoint !== null) && (
                  <td className="py-2 text-right">{s.gradePoint ?? "—"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {typeof markSheet.gpaSnapshot === "number" && (
          <p className="text-sm text-slate-700 mb-6">
            <span className="text-slate-400">Unweighted GPA: </span>
            <span className="font-semibold">{markSheet.gpaSnapshot.toFixed(2)}</span>
          </p>
        )}

        <div className="border-2 border-slate-800 rounded-xl p-4 mb-8 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Final Result</p>
          <p className="text-lg font-bold text-slate-800">{outcomeLabel}</p>
          {markSheet.outcomeGradeDisplayNameSnapshot && (
            <p className="text-sm text-slate-500 mt-1">
              {markSheet.outcomeStatus === "COMPLETED"
                ? `Promoted to ${markSheet.outcomeGradeDisplayNameSnapshot}`
                : `Repeating in ${markSheet.outcomeGradeDisplayNameSnapshot}`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-6 border-t border-slate-300">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Issue Date</p>
            <p className="text-slate-700">{new Date(markSheet.issuedAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">Issued By</p>
            <p className="text-slate-700">{markSheet.issuerNameSnapshot}</p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-dashed border-slate-300 text-xs text-slate-400 text-right">
          Authorized Signature ___________________________
        </div>
      </div>
    </div>
  );
}
