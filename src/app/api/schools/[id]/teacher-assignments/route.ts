import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
    prisma.teacher
      .findMany({ where: { schoolId: params.id, approved: true }, select: { id: true } })
      .then((r) => new Set(r.map((t) => t.id))),
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
    for (const a of assignments) {
      if (!validTeacherIds.has(a.teacherId) || !validGradeIds.has(a.schoolGradeId)) {
        skipped++;
        continue;
      }
      try {
        await tx.teacherGradeAssignment.create({
          data: { teacherId: a.teacherId, schoolGradeId: a.schoolGradeId, academicSessionId },
        });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++;
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  });

  return NextResponse.json({ ok: true, created, skipped });
}
