import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type AssignmentInput = { teacherId: string; schoolGradeId: string; sectionId?: string | null };

/**
 * Bulk-creates ClassTeacherAssignment rows for one session — a Grade
 * Coordinator (sectionId: null) or Class Teacher (sectionId: set).
 * These are responsibilities held by a Teacher, not separate teacher
 * types — the same person may simultaneously hold subject teaching
 * assignments plus either or both of these. Unlike
 * teacher-academic-assignments, grade-wide and section-specific rows
 * are allowed to coexist for the same grade (e.g. a Grade Coordinator
 * plus per-section Class Teachers) — no overlap check.
 * Uniqueness is on the SLOT (grade-or-section, per session), not the
 * teacher — at most one Grade Coordinator/Class Teacher per slot; a
 * request for an already-filled slot is silently skipped (the admin must remove
 * the existing assignment first, via the DELETE route, to replace it).
 *
 * @@unique([schoolGradeId, sectionId, academicSessionId]) reliably
 * catches a duplicate SECTION-SPECIFIC slot (sectionId is a real
 * value there), but — same NULL-in-unique-index caveat as
 * TeacherAcademicAssignment's grade-wide overlap rule — does NOT by
 * itself catch a second GRADE-WIDE row for the same grade/session,
 * since SQL treats NULL as distinct from NULL. So grade-wide slots are
 * pre-checked explicitly below, app-level, before the DB constraint
 * gets a chance to (not) catch it.
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
      { error: "Select at least one Grade Coordinator/Class Teacher assignment." },
      { status: 400 }
    );
  }

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const [validTeacherIds, validGradeIds, sectionsById] = await Promise.all([
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
          skipped++;
          continue;
        }
      } else {
        // Grade-wide slot — the DB unique constraint can't reliably
        // catch a second sectionId: null row for this grade/session
        // (NULL isn't distinct from NULL in a unique index), so check
        // explicitly. Runs inside the transaction so it also sees a
        // grade-wide row created earlier in this SAME batch.
        const existingGradeWide = await tx.classTeacherAssignment.findFirst({
          where: { schoolGradeId: a.schoolGradeId, sectionId: null, academicSessionId },
        });
        if (existingGradeWide) {
          skipped++;
          continue;
        }
      }
      try {
        await tx.classTeacherAssignment.create({
          data: { teacherId: a.teacherId, academicSessionId, schoolGradeId: a.schoolGradeId, sectionId },
        });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // this slot (grade or section, this session) already has a Grade Coordinator/Class Teacher
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  });

  return NextResponse.json({ ok: true, created, skipped });
}
