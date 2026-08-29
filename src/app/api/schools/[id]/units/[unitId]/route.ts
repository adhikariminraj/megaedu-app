import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

const TEACHING_UNIT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;

/**
 * Updates a TeachingUnit's title and/or teaching-progress status. Not
 * audited — current, freely-editable operational data, same as
 * TeacherAcademicAssignment. Status transitions manage startedAt/
 * completedAt: moving to IN_PROGRESS sets startedAt if not already
 * set; moving to COMPLETED sets completedAt (and backfills startedAt
 * if a unit was marked complete directly from NOT_STARTED); moving
 * back to NOT_STARTED or IN_PROGRESS from COMPLETED clears
 * completedAt, since it should only ever reflect the most recent
 * completion, not a historical log.
 */
export async function PATCH(
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

  const body = (await req.json()) as { title?: string; status?: string };
  if (body.status !== undefined && !TEACHING_UNIT_STATUSES.includes(body.status as any)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (body.title === undefined && body.status === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const data: { title?: string; status?: string; startedAt?: Date | null; completedAt?: Date | null } = {};
  if (body.title !== undefined) {
    if (!body.title.trim()) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
    data.title = body.title.trim();
  }
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "IN_PROGRESS") {
      if (!unit.startedAt) data.startedAt = new Date();
      if (unit.completedAt) data.completedAt = null;
    } else if (body.status === "COMPLETED") {
      data.completedAt = new Date();
      if (!unit.startedAt) data.startedAt = new Date();
    } else if (body.status === "NOT_STARTED") {
      data.startedAt = null;
      data.completedAt = null;
    }
  }

  const updated = await prisma.teachingUnit.update({ where: { id: params.unitId }, data });
  return NextResponse.json({ ok: true, unit: updated });
}
