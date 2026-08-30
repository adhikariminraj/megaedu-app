import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";
import { RESULT_STATUSES, correctComponentResult } from "@/lib/assessmentResults";

/**
 * The audited correction path for an AssessmentComponentResult that
 * already has a real entry — used both before publication (in which
 * case correctComponentResult() makes a plain update, no audit,
 * exactly like updateEvaluationRemarks() while an evaluation is still
 * private) and after (audited). This route's own job is only
 * authorization and validation; correctComponentResult() decides
 * whether an audit row is warranted.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; resultId: string } }
) {
  const result = await prisma.assessmentComponentResult.findUnique({
    where: { id: params.resultId },
    include: { component: true, gradeSubject: true, assignment: true },
  });
  if (!result || result.assignment.schoolId !== params.id) {
    return NextResponse.json({ error: "Result not found." }, { status: 404 });
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: result.assignment.academicSessionId,
      schoolGradeId: result.assignment.schoolGradeId,
      sectionId: null,
      subjectId: result.gradeSubject.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    status?: string;
    marksObtained?: number | null;
    gradeLabel?: string | null;
    remarks?: string | null;
  };
  if (!body.status || !RESULT_STATUSES.includes(body.status as any)) {
    return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
  }
  if (body.status === "EVALUATED") {
    if (result.component.entryMode === "MARKS") {
      if (typeof body.marksObtained !== "number" || body.marksObtained < 0 || body.marksObtained > result.component.maxMarks) {
        return NextResponse.json({ error: `marksObtained must be between 0 and ${result.component.maxMarks}.` }, { status: 400 });
      }
    }
    if (result.component.entryMode === "GRADE" && !body.gradeLabel) {
      return NextResponse.json({ error: "gradeLabel is required for a GRADE component." }, { status: 400 });
    }
  }

  const { result: updated, audit } = await correctComponentResult({
    resultId: params.resultId,
    newStatus: body.status as any,
    newMarksObtained: body.marksObtained,
    newGradeLabel: body.gradeLabel,
    newRemarks: body.remarks,
    changedByUserId: userId,
  });

  return NextResponse.json({ ok: true, result: updated, audited: !!audit });
}
