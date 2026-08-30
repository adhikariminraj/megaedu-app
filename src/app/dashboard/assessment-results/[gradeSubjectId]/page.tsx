import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveFrameworkAssignment } from "@/lib/assessmentFramework";
import AssessmentResultsEntryClient from "./AssessmentResultsEntryClient";

export const dynamic = "force-dynamic";

/**
 * Marks-entry + publish UI for ONE real subject, this session. Builds
 * the "virtual roster" the way UnitTest's own creation route computes
 * one — GradeHistory for this grade/session — and left-joins whatever
 * AssessmentComponentResult rows already exist, so every enrolled
 * student shows a blank/PENDING slot even before any row exists (see
 * docs/ASSESSMENT_RESULTS.md for why results are lazy, not
 * pre-created).
 */
export default async function AssessmentResultsEntryPage({ params }: { params: { gradeSubjectId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { subject: true, schoolGrade: { include: { school: true } }, academicSession: true },
  });
  if (!gradeSubject) notFound();
  const schoolId = gradeSubject.schoolGrade.schoolId;

  const [schoolAdmin, teacherAssignment] = await Promise.all([
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId } } }),
    prisma.teacherAcademicAssignment.findFirst({
      where: {
        teacher: { userId, schoolId, approved: true },
        academicSessionId: gradeSubject.academicSessionId,
        schoolGradeId: gradeSubject.schoolGradeId,
        subjectId: gradeSubject.subjectId,
      },
    }),
  ]);
  const isAdmin = !!schoolAdmin;
  if (!isAdmin && !teacherAssignment) redirect("/dashboard/assessment-results");

  const assignment = await resolveFrameworkAssignment({
    academicSessionId: gradeSubject.academicSessionId,
    schoolGradeId: gradeSubject.schoolGradeId,
    gradeSubjectId: gradeSubject.id,
  });

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {gradeSubject.schoolGrade.displayName} — {gradeSubject.subject.name}
        </h1>
        <p className="text-slate-500 text-sm">
          No assessment framework is assigned to this grade/subject yet.{" "}
          {isAdmin && (
            <a href="/dashboard/assessment-frameworks" className="text-mega-blue font-medium">
              Assign one →
            </a>
          )}
        </p>
      </div>
    );
  }

  const framework = await prisma.assessmentFramework.findUniqueOrThrow({
    where: { id: assignment.frameworkId },
    include: {
      periods: { orderBy: { order: "asc" } },
      components: { orderBy: { order: "asc" } },
      gradingScale: { include: { bands: { orderBy: { order: "asc" } } } },
    },
  });

  const roster = await prisma.gradeHistory.findMany({
    where: { academicSessionId: gradeSubject.academicSessionId, schoolGradeId: gradeSubject.schoolGradeId },
    include: { student: { include: { user: true } } },
    orderBy: { student: { user: { name: "asc" } } },
  });

  const [results, publications] = await Promise.all([
    prisma.assessmentComponentResult.findMany({
      where: {
        studentId: { in: roster.map((r) => r.studentId) },
        componentId: { in: framework.components.map((c) => c.id) },
      },
    }),
    prisma.assessmentResultPublication.findMany({
      where: { gradeSubjectId: gradeSubject.id, studentId: { in: roster.map((r) => r.studentId) } },
    }),
  ]);

  const publicationByStudentId = new Map(publications.map((p) => [p.studentId, p.status]));

  return (
    <AssessmentResultsEntryClient
      schoolId={schoolId}
      assignmentId={assignment.id}
      gradeSubjectId={gradeSubject.id}
      gradeName={gradeSubject.schoolGrade.displayName}
      subjectName={gradeSubject.subject.name}
      framework={{
        id: framework.id,
        name: framework.name,
        periods: framework.periods.map((p) => ({ id: p.id, name: p.name })),
        components: framework.components.map((c) => ({
          id: c.id,
          periodId: c.periodId,
          name: c.name,
          maxMarks: c.maxMarks,
          entryMode: c.entryMode,
        })),
        gradingScaleBands: framework.gradingScale?.bands.map((b) => ({ label: b.label })) ?? [],
      }}
      students={roster.map((r) => ({
        studentId: r.studentId,
        name: r.student.user.name,
        publicationStatus: publicationByStudentId.get(r.studentId) ?? "DRAFT",
      }))}
      results={results.map((r) => ({
        id: r.id,
        componentId: r.componentId,
        studentId: r.studentId,
        status: r.status,
        marksObtained: r.marksObtained,
        gradeLabel: r.gradeLabel,
        remarks: r.remarks,
      }))}
    />
  );
}
