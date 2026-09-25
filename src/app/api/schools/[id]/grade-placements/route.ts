import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type PlacementInput = { studentId: string; schoolGradeId: string; sectionId?: string | null };

/**
 * Bulk-creates a student's first GradeHistory row for a session
 * (status "ENROLLED", no decidedAt/outcomeGradeId). This is a direct
 * creation, deliberately NOT routed through recordGradeDecision() — a
 * brand-new placement isn't a decision changing an existing row, so
 * there's nothing to audit against yet. Only Promotion (an existing
 * row's outcome changing) goes through the audited helper. See
 * docs/PRODUCT_RULES.md and docs/GRADES_AND_PROMOTION.md.
 *
 * Idempotent — skips a student who already has a GradeHistory row for
 * this session (safe to re-submit in batches across the confident-match
 * and manual-assignment queues).
 *
 * sectionId is optional (sections are opt-in) and, when given, must be
 * an ACTIVE section belonging to the SAME schoolGradeId in that
 * placement row — a mismatched or inactive section fails that whole
 * placement rather than silently dropping the section or guessing.
 * Setting a section at creation time is not audited, same reasoning as
 * why the initial status:"ENROLLED" isn't — see reassignSection() in
 * src/lib/gradeHistory.ts for the audited path that changes it later.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { academicSessionId, placements } = (await req.json()) as {
    academicSessionId?: string;
    placements?: PlacementInput[];
  };
  if (!academicSessionId || !placements?.length) {
    return NextResponse.json({ error: "Select at least one student to place." }, { status: 400 });
  }

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const [validStudentIds, validGradeIds, activeSectionsByGrade] = await Promise.all([
    prisma.student
      .findMany({ where: { schoolId: params.id, approved: true }, select: { id: true } })
      .then((r) => new Set(r.map((s) => s.id))),
    prisma.schoolGrade
      .findMany({ where: { schoolId: params.id }, select: { id: true } })
      .then((r) => new Set(r.map((g) => g.id))),
    prisma.section
      .findMany({
        where: { schoolGrade: { schoolId: params.id }, isActive: true },
        select: { id: true, schoolGradeId: true },
      })
      .then((rows) => {
        const map = new Map<string, Set<string>>();
        for (const r of rows) {
          if (!map.has(r.schoolGradeId)) map.set(r.schoolGradeId, new Set());
          map.get(r.schoolGradeId)!.add(r.id);
        }
        return map;
      }),
  ]);

  // One transaction for the whole batch — a single commit instead of one
  // per row. Students already placed this session
  // (@@unique([studentId, academicSessionId])) are pre-checked inside the
  // transaction, never caught mid-transaction: on PostgreSQL one failed
  // statement aborts the whole transaction. `placed` is extended as rows
  // are created, so a student repeated within this same batch is also
  // skipped. A P2002 can now only mean a concurrent request placed the
  // same student first — the batch rolls back with a 409.
  let outcome: { created: number; skipped: number };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const placed = await tx.gradeHistory
        .findMany({
          where: { academicSessionId, studentId: { in: placements.map((p) => p.studentId) } },
          select: { studentId: true },
        })
        .then((rows) => new Set(rows.map((row) => row.studentId)));
      let created = 0;
      let skipped = 0;
      for (const p of placements) {
        if (!validStudentIds.has(p.studentId) || !validGradeIds.has(p.schoolGradeId)) {
          skipped++;
          continue;
        }
        if (p.sectionId && !activeSectionsByGrade.get(p.schoolGradeId)?.has(p.sectionId)) {
          skipped++; // section doesn't belong to this grade, isn't active, or doesn't exist
          continue;
        }
        if (placed.has(p.studentId)) {
          skipped++; // already placed for this session
          continue;
        }
        await tx.gradeHistory.create({
          data: {
            studentId: p.studentId,
            schoolGradeId: p.schoolGradeId,
            sectionId: p.sectionId || null,
            academicSessionId,
            status: "ENROLLED",
          },
        });
        placed.add(p.studentId);
        created++;
      }
      return { created, skipped };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Some of these students were just placed by someone else — please refresh and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, ...outcome });
}
