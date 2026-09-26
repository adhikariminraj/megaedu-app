import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

/**
 * Sets or updates the planned-total/display-label teaching plan for one
 * (gradeSubject, sectionId) scope. Find-or-update-else-create, not a
 * bare insert — at most one plan exists per (gradeSubjectId, sectionId).
 * The model's @@unique cannot catch two sectionId: null rows colliding
 * (NULLs are distinct), so a grade-wide plan is protected by a partial
 * unique index instead; see the create below. sectionId null means the
 * grade-wide plan.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; schoolGradeId: string; gradeSubjectId: string } }
) {
  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { schoolGrade: true },
  });
  if (
    !gradeSubject ||
    gradeSubject.schoolGrade.schoolId !== params.id ||
    gradeSubject.schoolGradeId !== params.schoolGradeId
  ) {
    return NextResponse.json({ error: "Subject offering not found." }, { status: 404 });
  }

  const body = (await req.json()) as {
    sectionId?: string | null;
    plannedTotal?: number;
    unitLabel?: string;
  };
  const { sectionId, unitLabel } = body;
  if (!Number.isInteger(body.plannedTotal) || (body.plannedTotal as number) < 1) {
    return NextResponse.json({ error: "Enter a planned total of at least 1." }, { status: 400 });
  }
  const plannedTotal: number = body.plannedTotal as number;

  const targetSectionId = sectionId || null;
  if (targetSectionId) {
    const section = await prisma.section.findUnique({ where: { id: targetSectionId } });
    if (!section || section.schoolGradeId !== params.schoolGradeId || !section.isActive) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireTeacherAssignment(params.id, {
      academicSessionId: gradeSubject.academicSessionId,
      schoolGradeId: params.schoolGradeId,
      sectionId: targetSectionId,
      subjectId: gradeSubject.subjectId,
    }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = { gradeSubjectId: params.gradeSubjectId, sectionId: targetSectionId };
  const updatePlan = (current: { id: string; unitLabel: string }) =>
    prisma.teachingPlan.update({
      where: { id: current.id },
      data: { plannedTotal, unitLabel: unitLabel?.trim() || current.unitLabel },
    });

  const existing = await prisma.teachingPlan.findFirst({ where: scope });
  if (existing) return NextResponse.json({ ok: true, plan: await updatePlan(existing) });

  try {
    const plan = await prisma.teachingPlan.create({
      data: {
        ...scope,
        academicSessionId: gradeSubject.academicSessionId,
        schoolGradeId: params.schoolGradeId,
        subjectId: gradeSubject.subjectId,
        plannedTotal,
        unitLabel: unitLabel?.trim() || "Unit",
        createdByUserId: userId,
      },
    });
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    // A simultaneous request created this scope's plan first: the model's
    // @@unique catches a section plan, the partial unique index
    // TeachingPlan_one_grade_wide_per_grade_subject a grade-wide one
    // (finding F2, rule A2). Setting a plan updates it, so update that row
    // instead; no ordering between simultaneous saves is defined.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const created = await prisma.teachingPlan.findFirst({ where: scope });
      if (created) return NextResponse.json({ ok: true, plan: await updatePlan(created) });
    }
    throw err;
  }
}
