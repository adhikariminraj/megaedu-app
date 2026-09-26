import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTransactionConflict } from "@/lib/dbErrors";
import { requireSchoolAdmin } from "@/lib/authorize";

type AssignmentInput = { teacherId: string; schoolGradeId: string };

/**
 * Bulk-creates TeacherGradeAssignment rows for one AcademicSession.
 * Assignments are per-session by design — nothing here carries anything
 * forward from a prior session. Silently skips a pairing that already
 * exists (idempotent — safe to re-submit) and ignores any teacher/grade
 * id that doesn't actually belong to this school.
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
      { error: "Select at least one teacher-grade assignment." },
      { status: 400 }
    );
  }

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const [validTeacherIds, validGradeIds] = await Promise.all([
    prisma.teacherSchoolAffiliation
      .findMany({ where: { schoolId: params.id, status: "ACTIVE" }, select: { teacherId: true } })
      .then((r) => new Set(r.map((a) => a.teacherId))),
    prisma.schoolGrade
      .findMany({ where: { schoolId: params.id }, select: { id: true } })
      .then((r) => new Set(r.map((g) => g.id))),
  ]);

  // One transaction for the whole batch — a single commit instead of one
  // per row. Existing pairings (@@unique([teacherId, schoolGradeId,
  // academicSessionId])) are pre-checked inside the transaction, never
  // caught mid-transaction: on PostgreSQL one failed statement aborts the
  // whole transaction. `paired` is extended as rows are created, so a
  // pairing repeated within this same batch is also skipped. A P2002 can
  // now only mean a concurrent request created the same pairing first —
  // the batch rolls back with a 409.
  const pairKey = (teacherId: string, schoolGradeId: string) => `${teacherId}:${schoolGradeId}`;
  let outcome: { created: number; skipped: number };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const paired = await tx.teacherGradeAssignment
        .findMany({ where: { academicSessionId }, select: { teacherId: true, schoolGradeId: true } })
        .then((rows) => new Set(rows.map((row) => pairKey(row.teacherId, row.schoolGradeId))));
      let created = 0;
      let skipped = 0;
      for (const a of assignments) {
        if (!validTeacherIds.has(a.teacherId) || !validGradeIds.has(a.schoolGradeId)) {
          skipped++;
          continue;
        }
        const pair = pairKey(a.teacherId, a.schoolGradeId);
        if (paired.has(pair)) {
          skipped++;
          continue;
        }
        await tx.teacherGradeAssignment.create({
          data: { teacherId: a.teacherId, schoolGradeId: a.schoolGradeId, academicSessionId },
        });
        paired.add(pair);
        created++;
      }
      return { created, skipped };
    });
  } catch (err) {
    // A deadlock or serialization failure (finding F3) also rolled the whole batch back: same 409, retry is safe.
    if ((err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || isTransactionConflict(err)) {
      return NextResponse.json(
        { error: "These assignments were just changed by someone else — please refresh and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, ...outcome });
}
