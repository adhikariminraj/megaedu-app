import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type PlacementInput = { studentId: string; schoolGradeId: string };

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

  const [validStudentIds, validGradeIds] = await Promise.all([
    prisma.student
      .findMany({ where: { schoolId: params.id, approved: true }, select: { id: true } })
      .then((r) => new Set(r.map((s) => s.id))),
    prisma.schoolGrade
      .findMany({ where: { schoolId: params.id }, select: { id: true } })
      .then((r) => new Set(r.map((g) => g.id))),
  ]);

  // One transaction for the whole batch — a single commit instead of one
  // per row. Note: this relies on SQLite tolerating a caught statement
  // error without poisoning the rest of the transaction, which is NOT
  // true on Postgres (the schema's eventual production target) — there,
  // one failed statement aborts the transaction until rollback, so this
  // same per-item try/catch would start reporting every subsequent item
  // as failed too. Revisit this when migrating off SQLite.
  const { created, skipped } = await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    for (const p of placements) {
      if (!validStudentIds.has(p.studentId) || !validGradeIds.has(p.schoolGradeId)) {
        skipped++;
        continue;
      }
      try {
        await tx.gradeHistory.create({
          data: {
            studentId: p.studentId,
            schoolGradeId: p.schoolGradeId,
            academicSessionId,
            status: "ENROLLED",
          },
        });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // already placed for this session
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  });

  return NextResponse.json({ ok: true, created, skipped });
}
