import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { assignmentCollisionExists } from "@/lib/assessmentFramework";

/**
 * Binds a reusable AssessmentFramework to one (AcademicSession,
 * SchoolGrade), optionally narrowed to one GradeSubject as a
 * subject-specific override. gradeSubjectId omitted/null = the grade's
 * DEFAULT assignment. Duplicate protection is an explicit pre-check
 * (assignmentCollisionExists), not just the DB constraint — see the
 * NULL≠NULL note on AssessmentFrameworkAssignment in schema.prisma.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { academicSessionId, schoolGradeId, gradeSubjectId, frameworkId } = (await req.json()) as {
    academicSessionId?: string;
    schoolGradeId?: string;
    gradeSubjectId?: string | null;
    frameworkId?: string;
  };
  if (!academicSessionId || !schoolGradeId || !frameworkId) {
    return NextResponse.json(
      { error: "academicSessionId, schoolGradeId, and frameworkId are required." },
      { status: 400 }
    );
  }

  const [session, schoolGrade, framework] = await Promise.all([
    prisma.academicSession.findUnique({ where: { id: academicSessionId } }),
    prisma.schoolGrade.findUnique({ where: { id: schoolGradeId } }),
    prisma.assessmentFramework.findUnique({ where: { id: frameworkId } }),
  ]);
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }
  if (!schoolGrade || schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid grade." }, { status: 400 });
  }
  if (!framework || framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid framework." }, { status: 400 });
  }

  let resolvedGradeSubjectId: string | null = null;
  if (gradeSubjectId) {
    const gradeSubject = await prisma.gradeSubject.findUnique({ where: { id: gradeSubjectId } });
    if (
      !gradeSubject ||
      gradeSubject.schoolGradeId !== schoolGradeId ||
      gradeSubject.academicSessionId !== academicSessionId
    ) {
      return NextResponse.json(
        { error: "That subject isn't offered at this grade this session." },
        { status: 400 }
      );
    }
    resolvedGradeSubjectId = gradeSubjectId;
  }

  if (
    await assignmentCollisionExists({
      academicSessionId,
      schoolGradeId,
      gradeSubjectId: resolvedGradeSubjectId,
    })
  ) {
    return NextResponse.json(
      {
        error: resolvedGradeSubjectId
          ? "This subject already has a framework assigned for this grade/session."
          : "This grade already has a default framework assigned for this session.",
      },
      { status: 409 }
    );
  }

  const assignment = await prisma.assessmentFrameworkAssignment.create({
    data: {
      schoolId: params.id,
      academicSessionId,
      schoolGradeId,
      gradeSubjectId: resolvedGradeSubjectId,
      frameworkId,
    },
    include: { framework: true, gradeSubject: { include: { subject: true } }, schoolGrade: true },
  });
  return NextResponse.json({ ok: true, assignment });
}
