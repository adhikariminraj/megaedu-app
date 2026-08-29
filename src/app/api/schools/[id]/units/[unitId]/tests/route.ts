import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

/**
 * Creates a UnitTest under a TeachingUnit, only once that unit is
 * IN_PROGRESS or COMPLETED (route-level rule — a test shouldn't exist
 * for a unit that hasn't been taught yet). Pre-creates a UnitTestResult
 * row, status PENDING, for every student currently enrolled in the
 * test's scope (via GradeHistory, matching the unit's own
 * schoolGradeId and — if set — sectionId) — a stable roster snapshot,
 * not something inferred later by diffing against a roster that could
 * change. Multiple tests per unit are allowed (e.g. a quiz and a
 * chapter test) — no uniqueness constraint blocks it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; unitId: string } }
) {
  const unit = await prisma.teachingUnit.findUnique({
    where: { id: params.unitId },
    include: { schoolGrade: true },
  });
  if (!unit || unit.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Unit not found." }, { status: 404 });
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: unit.academicSessionId,
      schoolGradeId: unit.schoolGradeId,
      sectionId: unit.sectionId,
      subjectId: unit.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (unit.status === "NOT_STARTED") {
    return NextResponse.json(
      { error: "This unit hasn't been started yet — mark it In Progress before creating a test." },
      { status: 400 }
    );
  }

  const { title, testDate, maxMarks } = (await req.json()) as {
    title?: string;
    testDate?: string;
    maxMarks?: number;
  };
  if (!title?.trim() || !testDate || !Number.isInteger(maxMarks) || (maxMarks as number) < 1) {
    return NextResponse.json(
      { error: "A title, date, and a maximum marks of at least 1 are required." },
      { status: 400 }
    );
  }
  const parsedDate = new Date(testDate);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid test date." }, { status: 400 });
  }

  const roster = await prisma.gradeHistory.findMany({
    where: {
      academicSessionId: unit.academicSessionId,
      schoolGradeId: unit.schoolGradeId,
      ...(unit.sectionId ? { sectionId: unit.sectionId } : {}),
    },
    select: { studentId: true },
  });

  const { test, resultCount } = await prisma.$transaction(async (tx) => {
    const test = await tx.unitTest.create({
      data: {
        unitId: params.unitId,
        title: title.trim(),
        testDate: parsedDate,
        maxMarks: maxMarks as number,
        createdByUserId: userId,
      },
    });
    if (roster.length > 0) {
      await tx.unitTestResult.createMany({
        data: roster.map((r) => ({ unitTestId: test.id, studentId: r.studentId })),
      });
    }
    return { test, resultCount: roster.length };
  });

  return NextResponse.json({ ok: true, test, resultCount });
}
