import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";
import { RESULT_STATUSES } from "@/lib/assessmentResults";

type ResultInput = {
  studentId: string;
  status: string;
  marksObtained?: number | null;
  gradeLabel?: string | null;
  remarks?: string | null;
};

/**
 * Bulk-creates/updates AssessmentComponentResult rows for one
 * component, for one real subject in session — lazy, never
 * pre-created (see docs/ASSESSMENT_RESULTS.md for why this diverges
 * from UnitTestResult's eager-roster pattern). Each item is
 * find-or-create: a first-time entry creates the row; a later entry
 * for the same student updates it directly (only ever a plain update
 * here — publication-aware, audited correction is a separate path,
 * PATCH /api/schools/[id]/assessment-results/[resultId], used once a
 * result has already been entered and its subject published).
 *
 * gradeSubjectId is required in the body and is the SOURCE OF TRUTH
 * for authorization — resolved independently of whether the
 * assignment governing this component is a grade-default or a
 * subject-override, since entering marks always happens in the
 * context of one real, specific subject.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; assignmentId: string; componentId: string } }
) {
  const assignment = await prisma.assessmentFrameworkAssignment.findUnique({
    where: { id: params.assignmentId },
  });
  if (!assignment || assignment.schoolId !== params.id) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const component = await prisma.assessmentComponent.findUnique({ where: { id: params.componentId } });
  if (!component || component.frameworkId !== assignment.frameworkId) {
    return NextResponse.json({ error: "Component not found in this framework." }, { status: 404 });
  }

  const body = (await req.json()) as { gradeSubjectId?: string; results?: ResultInput[] };
  if (!body.gradeSubjectId || !body.results?.length) {
    return NextResponse.json({ error: "gradeSubjectId and at least one result are required." }, { status: 400 });
  }

  const gradeSubject = await prisma.gradeSubject.findUnique({ where: { id: body.gradeSubjectId } });
  if (
    !gradeSubject ||
    gradeSubject.schoolGradeId !== assignment.schoolGradeId ||
    gradeSubject.academicSessionId !== assignment.academicSessionId
  ) {
    return NextResponse.json({ error: "Invalid subject for this assignment's grade/session." }, { status: 400 });
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: assignment.academicSessionId,
      schoolGradeId: assignment.schoolGradeId,
      sectionId: null,
      subjectId: gradeSubject.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only students currently enrolled in this exact grade/session may
  // receive a result — the same roster boundary UnitTest's own
  // creation route enforces.
  const roster = await prisma.gradeHistory.findMany({
    where: { academicSessionId: assignment.academicSessionId, schoolGradeId: assignment.schoolGradeId },
    select: { studentId: true },
  });
  const rosterIds = new Set(roster.map((r) => r.studentId));

  // Once a student's subject is PUBLISHED, this plain-upsert path is
  // closed — further changes must go through the audited correction
  // route (PATCH /api/schools/[id]/assessment-results/[resultId]) so a
  // published result can never be silently rewritten without a trace.
  const publishedStudentIds = new Set(
    (
      await prisma.assessmentResultPublication.findMany({
        where: {
          gradeSubjectId: body.gradeSubjectId,
          studentId: { in: body.results.map((r) => r.studentId) },
          status: "PUBLISHED",
        },
        select: { studentId: true },
      })
    ).map((p) => p.studentId)
  );

  let updated = 0;
  let skipped = 0;
  for (const r of body.results) {
    if (!rosterIds.has(r.studentId) || !RESULT_STATUSES.includes(r.status as any) || publishedStudentIds.has(r.studentId)) {
      skipped++;
      continue;
    }
    if (r.status === "EVALUATED") {
      const validMarks = component.entryMode === "MARKS" ? typeof r.marksObtained === "number" && r.marksObtained >= 0 && r.marksObtained <= component.maxMarks : true;
      const validGrade = component.entryMode === "GRADE" ? !!r.gradeLabel : true;
      if (!validMarks || !validGrade) {
        skipped++;
        continue;
      }
    }

    const isAbsent = r.status === "ABSENT";
    await prisma.assessmentComponentResult.upsert({
      where: { componentId_studentId: { componentId: params.componentId, studentId: r.studentId } },
      create: {
        componentId: params.componentId,
        gradeSubjectId: body.gradeSubjectId,
        assignmentId: params.assignmentId,
        studentId: r.studentId,
        status: r.status,
        marksObtained: isAbsent ? null : component.entryMode === "MARKS" ? r.marksObtained ?? null : null,
        gradeLabel: isAbsent ? null : component.entryMode === "GRADE" ? r.gradeLabel ?? null : null,
        remarks: isAbsent ? null : r.remarks ?? null,
        evaluatedByUserId: userId,
        evaluatedAt: new Date(),
      },
      update: {
        status: r.status,
        marksObtained: isAbsent ? null : component.entryMode === "MARKS" ? r.marksObtained ?? null : null,
        gradeLabel: isAbsent ? null : component.entryMode === "GRADE" ? r.gradeLabel ?? null : null,
        remarks: isAbsent ? null : r.remarks ?? null,
        evaluatedByUserId: userId,
        evaluatedAt: new Date(),
      },
    });

    // Lazily ensure a DRAFT publication row exists for this
    // student/subject — creation itself is not a decision (same
    // reasoning as GradeHistory's unaudited first placement); it just
    // marks "this subject now has at least one entered result."
    await prisma.assessmentResultPublication.upsert({
      where: { gradeSubjectId_studentId: { gradeSubjectId: body.gradeSubjectId, studentId: r.studentId } },
      create: { gradeSubjectId: body.gradeSubjectId, studentId: r.studentId, assignmentId: params.assignmentId, status: "DRAFT" },
      update: {},
    });

    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
