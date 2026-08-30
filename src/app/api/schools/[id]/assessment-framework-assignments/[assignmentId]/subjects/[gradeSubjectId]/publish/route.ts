import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";
import { aggregateGroup } from "@/lib/assessmentResults";

/**
 * Bulk-publishes one subject's results — DRAFT -> PUBLISHED — for
 * every eligible student in the roster, or just the given studentIds.
 * "Eligible" means every non-DESCRIPTIVE component is EVALUATED or
 * ABSENT (none still PENDING) — the structural half of "avoid Parents/
 * Students seeing incomplete marks": even a caller that skipped the
 * client-side completeness check cannot publish an incomplete result
 * through this route. Ineligible/already-published students are
 * silently skipped, not an error, matching the established
 * {created, skipped} bulk-response convention used throughout this app.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; assignmentId: string; gradeSubjectId: string } }
) {
  const assignment = await prisma.assessmentFrameworkAssignment.findUnique({ where: { id: params.assignmentId } });
  if (!assignment || assignment.schoolId !== params.id) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { subject: true },
  });
  if (
    !gradeSubject ||
    gradeSubject.schoolGradeId !== assignment.schoolGradeId ||
    gradeSubject.academicSessionId !== assignment.academicSessionId
  ) {
    return NextResponse.json({ error: "Invalid subject for this assignment." }, { status: 400 });
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

  const { studentIds } = (await req.json().catch(() => ({}))) as { studentIds?: string[] };

  const framework = await prisma.assessmentFramework.findUniqueOrThrow({
    where: { id: assignment.frameworkId },
    include: { components: true },
  });

  const roster = await prisma.gradeHistory.findMany({
    where: {
      academicSessionId: assignment.academicSessionId,
      schoolGradeId: assignment.schoolGradeId,
      ...(studentIds?.length ? { studentId: { in: studentIds } } : {}),
    },
    select: { studentId: true },
  });

  let published = 0;
  let skipped = 0;
  for (const { studentId } of roster) {
    const existing = await prisma.assessmentResultPublication.findUnique({
      where: { gradeSubjectId_studentId: { gradeSubjectId: params.gradeSubjectId, studentId } },
    });
    if (existing?.status === "PUBLISHED") {
      skipped++; // already published — nothing to do
      continue;
    }

    const results = await prisma.assessmentComponentResult.findMany({
      where: { studentId, componentId: { in: framework.components.map((c) => c.id) } },
    });
    // bands: [] is deliberate — completeness only depends on each
    // component's status (PENDING or not), never its computed value,
    // so no grading-scale lookup is needed for this check.
    const { isComplete } = aggregateGroup(framework.components, results, []);
    if (!isComplete) {
      skipped++; // a required component is still PENDING
      continue;
    }

    await prisma.assessmentResultPublication.upsert({
      where: { gradeSubjectId_studentId: { gradeSubjectId: params.gradeSubjectId, studentId } },
      create: {
        gradeSubjectId: params.gradeSubjectId,
        studentId,
        assignmentId: params.assignmentId,
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedByUserId: userId,
      },
      update: { status: "PUBLISHED", publishedAt: new Date(), publishedByUserId: userId },
    });
    published++;
  }

  return NextResponse.json({ ok: true, published, skipped });
}
