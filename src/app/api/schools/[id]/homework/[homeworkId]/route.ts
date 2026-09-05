import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireTeacherAssignment } from "@/lib/authorize";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  instructions: z.string().trim().min(1).max(4000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sectionId: z.string().min(1).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

/**
 * Edits a DRAFT Homework item's fields, and/or publishes it.
 * Authorization is re-verified fresh against the homework row's OWN
 * stored scope (School Admin, or a Teacher with a matching
 * TeacherAcademicAssignment for that exact grade/section/subject/
 * session) — never just "are you the teacher who originally created
 * this," matching the no-hierarchy-among-teachers precedent already
 * established for TeacherAcademicAssignment.
 *
 * Once PUBLISHED, title/instructions/dueDate/sectionId become frozen
 * for this phase — matching the "permanent once shared" precedent
 * already established for StudentEvaluation sharing and Certificate
 * issuance elsewhere in this schema. Only the DRAFT -> PUBLISHED
 * transition itself is allowed afterward (idempotent: publishing an
 * already-PUBLISHED item is a harmless no-op, not an error).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; homeworkId: string } }
) {
  const homework = await prisma.homework.findUnique({ where: { id: params.homeworkId } });
  if (!homework) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Defense in depth: the homework must actually belong to the school in
  // the URL, checked via its schoolGrade, not assumed from the id alone.
  const schoolGrade = await prisma.schoolGrade.findUnique({ where: { id: homework.schoolGradeId } });
  if (!schoolGrade || schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, instructions, dueDate, status } = parsed.data;
  const sectionId = parsed.data.sectionId !== undefined ? parsed.data.sectionId : undefined;

  const adminUserId = await requireSchoolAdmin(params.id);
  const teacherUserId = adminUserId
    ? null
    : await requireTeacherAssignment(params.id, {
        academicSessionId: homework.academicSessionId,
        schoolGradeId: homework.schoolGradeId,
        sectionId: homework.sectionId,
        subjectId: homework.subjectId,
      });
  if (!adminUserId && !teacherUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fieldEditRequested =
    title !== undefined || instructions !== undefined || dueDate !== undefined || sectionId !== undefined;

  if (fieldEditRequested && homework.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "This homework has already been published and can no longer be edited." },
      { status: 409 }
    );
  }

  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.schoolGradeId !== homework.schoolGradeId || !section.isActive) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }
  }

  let parsedDueDate: Date | undefined;
  if (dueDate !== undefined) {
    parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (instructions !== undefined) data.instructions = instructions;
  if (parsedDueDate !== undefined) data.dueDate = parsedDueDate;
  if (sectionId !== undefined) data.sectionId = sectionId;

  if (status === "PUBLISHED" && homework.status === "DRAFT") {
    data.status = "PUBLISHED";
    data.publishedAt = new Date();
  }
  // status === "DRAFT" or re-requesting "PUBLISHED" on an already-
  // published item: no status change, matching the no-unpublish /
  // idempotent-publish behavior documented above.

  const updated = await prisma.homework.update({
    where: { id: params.homeworkId },
    data,
  });

  return NextResponse.json({ ok: true, homework: updated });
}
