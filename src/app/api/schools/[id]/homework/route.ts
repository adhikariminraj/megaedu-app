import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTeacherAssignment } from "@/lib/authorize";
import { CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";

const createSchema = z.object({
  schoolGradeId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  gradeSubjectId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required.").max(150),
  instructions: z.string().trim().min(1, "Instructions are required.").max(4000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be a YYYY-MM-DD date."),
  // K1 — Individual Homework. When set, this Homework targets exactly
  // this one student instead of the grade/section above; sectionId is
  // ignored (forced to null) in that case, since section is irrelevant
  // to who an Individual Homework applies to.
  targetStudentId: z.string().min(1).nullable().optional(),
});

/**
 * Creates one DRAFT Homework item for a grade (or one section of it).
 * Teacher-only in this phase — deliberately NOT composed with
 * requireSchoolAdmin the way the analogous TeachingUnit create route is
 * (src/app/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/units/route.ts):
 * Homework.teacherId is a real, non-nullable Teacher identity (per the
 * approved design — see schema.prisma), and nothing in the approved
 * Phase 1 scope describes a School Admin authoring "on behalf of" a
 * named teacher the way Evaluations does. Restricting creation to the
 * caller's own resolved Teacher identity avoids that ambiguity
 * entirely, with no loss of approved functionality.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { schoolGradeId, gradeSubjectId, title, instructions, dueDate } = parsed.data;
  const targetStudentId = parsed.data.targetStudentId || null;
  // Individual Homework: sectionId is irrelevant to who this applies
  // to — forced to null regardless of what was submitted, so the row
  // can never end up in an inconsistent "individual AND section-scoped"
  // shape.
  const sectionId = targetStudentId ? null : parsed.data.sectionId || null;

  // Never trust client-supplied relational ids in isolation — resolve
  // gradeSubject first and cross-check every other id against it,
  // matching the exact validation shape of the TeachingUnit create
  // route above.
  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: gradeSubjectId },
    include: { schoolGrade: true },
  });
  if (
    !gradeSubject ||
    gradeSubject.schoolGrade.schoolId !== params.id ||
    gradeSubject.schoolGradeId !== schoolGradeId
  ) {
    return NextResponse.json({ error: "Subject offering not found." }, { status: 404 });
  }

  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.schoolGradeId !== schoolGradeId || !section.isActive) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }
  }

  const parsedDueDate = new Date(dueDate);
  if (isNaN(parsedDueDate.getTime())) {
    return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
  }

  // K1 — Individual Homework target validation. Resolves the target
  // student's OWN current placement for this exact grade/session (never
  // trusted from client input in isolation) — both to confirm they
  // genuinely belong here (never just "does this Student id exist
  // anywhere"), and to derive their real sectionId, which becomes the
  // authorization scope below: a teacher may create Individual Homework
  // for this student only if their own TeacherAcademicAssignment
  // actually covers the student's real section (grade-wide, or that
  // exact section) — not merely "teaches this subject somewhere in the
  // grade." Re-validated again, independently, at publish time
  // (resolveIndividualTarget(), src/lib/homework.ts) since time may
  // have passed since this create request.
  let targetSectionId: string | null = null;
  if (targetStudentId) {
    const targetPlacement = await prisma.gradeHistory.findFirst({
      where: {
        studentId: targetStudentId,
        academicSessionId: gradeSubject.academicSessionId,
        schoolGradeId,
        status: { in: CURRENT_ROSTER_STATUSES },
      },
    });
    if (!targetPlacement) {
      return NextResponse.json(
        { error: "That student is not currently placed in this grade/session." },
        { status: 400 }
      );
    }
    targetSectionId = targetPlacement.sectionId;
  }

  const userId = await requireTeacherAssignment(params.id, {
    academicSessionId: gradeSubject.academicSessionId,
    schoolGradeId,
    sectionId: targetStudentId ? targetSectionId : sectionId,
    subjectId: gradeSubject.subjectId,
  });
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // requireTeacherAssignment() already confirmed a Teacher row + an
  // ACTIVE affiliation + a matching assignment exist for this userId —
  // this is just reading the Teacher.id it already implicitly proved
  // exists, not a second authorization check.
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const homework = await prisma.homework.create({
    data: {
      academicSessionId: gradeSubject.academicSessionId,
      schoolGradeId,
      sectionId,
      gradeSubjectId,
      subjectId: gradeSubject.subjectId,
      teacherId: teacher.id,
      title: title.trim(),
      instructions: instructions.trim(),
      dueDate: parsedDueDate,
      targetStudentId,
    },
  });

  return NextResponse.json({ ok: true, homework });
}
