import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment, requireClassTeacher } from "@/lib/authorize";
import { updateEvaluationRemarks, shareEvaluation } from "@/lib/evaluation";

/**
 * Edits an evaluation's remarks and/or shares it with the Parent and/or
 * Student. Authorization is re-resolved from the evaluation's OWN
 * stored scope (schoolGradeId/sectionId/gradeSubjectId), never
 * re-trusted from client input. Remarks edits go through
 * updateEvaluationRemarks() — a no-op audit if still private, a full
 * audited change once shared with either audience. Sharing is one-way
 * (no un-share) — see src/lib/evaluation.ts.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; evaluationId: string } }
) {
  const evaluation = await prisma.studentEvaluation.findUnique({
    where: { id: params.evaluationId },
    include: { schoolGrade: true },
  });
  if (!evaluation || evaluation.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Evaluation not found." }, { status: 404 });
  }

  const scope = {
    academicSessionId: evaluation.academicSessionId,
    schoolGradeId: evaluation.schoolGradeId,
    sectionId: evaluation.sectionId,
  };

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    evaluation.gradeSubjectId
      ? (async () => {
          const gradeSubject = await prisma.gradeSubject.findUnique({ where: { id: evaluation.gradeSubjectId! } });
          return gradeSubject
            ? requireTeacherAssignment(params.id, { ...scope, subjectId: gradeSubject.subjectId })
            : null;
        })()
      : requireClassTeacher(params.id, scope),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { remarks?: string; share?: "PARENT" | "STUDENT" };
  if (!body.remarks?.trim() && !body.share) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  let updated = evaluation as typeof evaluation;

  if (body.remarks?.trim()) {
    const result = await updateEvaluationRemarks({
      evaluationId: params.evaluationId,
      newRemarks: body.remarks.trim(),
      changedByUserId: userId,
    });
    updated = { ...updated, ...result.evaluation };
  }

  if (body.share === "PARENT" || body.share === "STUDENT") {
    updated = { ...updated, ...(await shareEvaluation({ evaluationId: params.evaluationId, audience: body.share })) };
  }

  return NextResponse.json({ ok: true, evaluation: updated });
}
