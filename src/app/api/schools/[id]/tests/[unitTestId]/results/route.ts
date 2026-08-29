import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

const RESULT_STATUSES = ["PENDING", "EVALUATED", "ABSENT"] as const;

type ResultInput = { studentId: string; status: string; marksObtained?: number | null; remarks?: string | null };

/**
 * Bulk-records evaluation results for a test's pre-created
 * UnitTestResult rows — only existing rows are updated, never created
 * here (the roster was fixed at test-creation time). status:
 * "ABSENT" forces marksObtained to null regardless of what's passed;
 * status: "EVALUATED" requires a real marksObtained between 0 and the
 * test's maxMarks. No retest concept.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; unitTestId: string } }
) {
  const test = await prisma.unitTest.findUnique({
    where: { id: params.unitTestId },
    include: { unit: { include: { schoolGrade: true } } },
  });
  if (!test || test.unit.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Test not found." }, { status: 404 });
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: test.unit.academicSessionId,
      schoolGradeId: test.unit.schoolGradeId,
      sectionId: test.unit.sectionId,
      subjectId: test.unit.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { results } = (await req.json()) as { results?: ResultInput[] };
  if (!results?.length) {
    return NextResponse.json({ error: "No results to record." }, { status: 400 });
  }

  const existing = await prisma.unitTestResult.findMany({
    where: { unitTestId: params.unitTestId, studentId: { in: results.map((r) => r.studentId) } },
    select: { id: true, studentId: true },
  });
  const resultIdByStudent = new Map(existing.map((r) => [r.studentId, r.id]));

  let updated = 0;
  let skipped = 0;
  for (const r of results) {
    const resultId = resultIdByStudent.get(r.studentId);
    if (!resultId || !RESULT_STATUSES.includes(r.status as any)) {
      skipped++;
      continue;
    }
    if (r.status === "EVALUATED") {
      if (
        typeof r.marksObtained !== "number" ||
        r.marksObtained < 0 ||
        r.marksObtained > test.maxMarks
      ) {
        skipped++;
        continue;
      }
    }
    await prisma.unitTestResult.update({
      where: { id: resultId },
      data: {
        status: r.status,
        marksObtained: r.status === "ABSENT" ? null : r.status === "EVALUATED" ? r.marksObtained : null,
        remarks: r.remarks === undefined ? undefined : r.remarks,
        evaluatedByUserId: userId,
        evaluatedAt: new Date(),
      },
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
