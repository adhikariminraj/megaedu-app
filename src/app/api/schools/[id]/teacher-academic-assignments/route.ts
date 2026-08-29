import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type AssignmentInput = {
  teacherId: string;
  schoolGradeId: string;
  sectionId?: string | null;
  subjectId: string;
};

/**
 * Bulk-creates TeacherAcademicAssignment rows for one session. For each
 * item: teacher/grade/section must be real and belong to this school;
 * the subject must actually be offered at this grade THIS session (a
 * matching GradeSubject row must exist — its id becomes the FK, so a
 * teacher can never be assigned to teach a subject the grade doesn't
 * offer). sectionId null means grade-wide (every section); a non-null
 * value means one specific section.
 *
 * Overlap rule (server-side, not a DB constraint — see schema comment
 * on TeacherAcademicAssignment for why): the SAME teacher may never
 * hold both a grade-wide AND a section-specific row for the same
 * (teacherId, academicSessionId, schoolGradeId, subjectId) tuple.
 * Requesting a grade-wide assignment is rejected if ANY row already
 * exists for that tuple; requesting a section-specific assignment is
 * rejected only if a grade-wide row already exists for that tuple —
 * other sections for the same teacher/subject are unaffected. Multiple
 * DIFFERENT teachers may freely overlap on the same subject/grade/
 * section — no hierarchy, no primary/assistant concept.
 *
 * Runs as one transaction with a sequential per-item loop (not
 * parallel) so each item's overlap check sees rows created earlier in
 * the SAME batch, not just what was already in the database before the
 * request started.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { academicSessionId, assignments } = (await req.json()) as {
    academicSessionId?: string;
    assignments?: AssignmentInput[];
  };
  if (!academicSessionId || !assignments?.length) {
    return NextResponse.json(
      { error: "Select at least one teacher academic assignment." },
      { status: 400 }
    );
  }

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const [validTeacherIds, validGradeIds, sectionsById, gradeSubjectsByKey] = await Promise.all([
    prisma.teacher
      .findMany({ where: { schoolId: params.id, approved: true }, select: { id: true } })
      .then((r) => new Set(r.map((t) => t.id))),
    prisma.schoolGrade
      .findMany({ where: { schoolId: params.id }, select: { id: true } })
      .then((r) => new Set(r.map((g) => g.id))),
    prisma.section
      .findMany({
        where: { schoolGrade: { schoolId: params.id } },
        select: { id: true, schoolGradeId: true, isActive: true },
      })
      .then((rows) => new Map(rows.map((s) => [s.id, s]))),
    prisma.gradeSubject
      .findMany({
        where: { academicSessionId, schoolGrade: { schoolId: params.id } },
        select: { id: true, schoolGradeId: true, subjectId: true },
      })
      .then((rows) => new Map(rows.map((gs) => [`${gs.schoolGradeId}:${gs.subjectId}`, gs.id]))),
  ]);

  const { created, skipped } = await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;

    for (const a of assignments) {
      if (!validTeacherIds.has(a.teacherId) || !validGradeIds.has(a.schoolGradeId)) {
        skipped++;
        continue;
      }

      const sectionId = a.sectionId || null;
      if (sectionId) {
        const section = sectionsById.get(sectionId);
        if (!section || section.schoolGradeId !== a.schoolGradeId || !section.isActive) {
          skipped++; // wrong grade, deactivated, or doesn't exist
          continue;
        }
      }

      const gradeSubjectId = gradeSubjectsByKey.get(`${a.schoolGradeId}:${a.subjectId}`);
      if (!gradeSubjectId) {
        skipped++; // this subject isn't offered at this grade this session
        continue;
      }

      const existing = await tx.teacherAcademicAssignment.findMany({
        where: {
          teacherId: a.teacherId,
          academicSessionId,
          schoolGradeId: a.schoolGradeId,
          subjectId: a.subjectId,
        },
        select: { sectionId: true },
      });
      const overlaps = sectionId
        ? existing.some((e) => e.sectionId === null) // section-specific request vs. an existing grade-wide row
        : existing.length > 0; // grade-wide request vs. ANY existing row
      if (overlaps) {
        skipped++;
        continue;
      }

      try {
        await tx.teacherAcademicAssignment.create({
          data: {
            teacherId: a.teacherId,
            academicSessionId,
            schoolGradeId: a.schoolGradeId,
            sectionId,
            subjectId: a.subjectId,
            gradeSubjectId,
          },
        });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // exact duplicate (same teacher/session/grade/section/subject)
          continue;
        }
        throw err;
      }
    }

    return { created, skipped };
  });

  return NextResponse.json({ ok: true, created, skipped });
}
