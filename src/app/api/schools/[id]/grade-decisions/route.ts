import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { recordGradeDecision, type GradeHistoryStatus } from "@/lib/gradeHistory";

// Only real decisions are made through this route — ENROLLED is the
// starting state a row is created with, never something you "decide"
// your way back into.
const DECISION_STATUSES: GradeHistoryStatus[] = ["COMPLETED", "REPEATED", "TRANSFERRED", "LEFT"];

/**
 * Bulk-applies one Promotion decision (Promote/Repeat/Transfer/Leave) to
 * a multi-selected set of currently-ENROLLED students, per the Student
 * Promotion workflow. Every row goes through recordGradeDecision() — the
 * only path allowed to touch GradeHistory.status/outcomeGradeId — inside
 * ONE prisma.$transaction, so a bulk decision is one commit, not N.
 *
 * Unlike the Initial Setup bulk-create routes, this one doesn't need a
 * per-item try/catch for duplicates: every id is validated as belonging
 * to this school and currently ENROLLED *before* the transaction opens,
 * and recordGradeDecision() only ever updates an existing row by its own
 * primary key — there's no unique-constraint collision this can hit.
 * So an error partway through legitimately means something unexpected
 * happened, and rolling back the whole batch is the correct behavior,
 * not a bug to work around.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gradeHistoryIds, status, outcomeSchoolGradeId } = (await req.json()) as {
    gradeHistoryIds?: string[];
    status?: string;
    outcomeSchoolGradeId?: string | null;
  };

  if (!gradeHistoryIds?.length || !status || !DECISION_STATUSES.includes(status as GradeHistoryStatus)) {
    return NextResponse.json(
      { error: "Select at least one student and a decision (Promote, Repeat, Transfer, or Leave)." },
      { status: 400 }
    );
  }

  const needsOutcome = status === "COMPLETED" || status === "REPEATED";
  if (needsOutcome && !outcomeSchoolGradeId) {
    return NextResponse.json(
      { error: "Select which grade these students are moving to." },
      { status: 400 }
    );
  }

  if (outcomeSchoolGradeId) {
    const outcomeGrade = await prisma.schoolGrade.findUnique({ where: { id: outcomeSchoolGradeId } });
    if (!outcomeGrade || outcomeGrade.schoolId !== params.id) {
      return NextResponse.json({ error: "Invalid outcome grade." }, { status: 400 });
    }
  }

  // Pre-filter to rows that actually belong to this school and are
  // currently ENROLLED — this is the eligibility check the roster UI
  // already implies (only ENROLLED students are ever shown/selectable),
  // enforced again server-side rather than trusted from the client.
  const rows = await prisma.gradeHistory.findMany({
    where: { id: { in: gradeHistoryIds } },
    include: { schoolGrade: true },
  });
  const validIds = rows
    .filter((r) => r.schoolGrade.schoolId === params.id && r.status === "ENROLLED")
    .map((r) => r.id);
  const skipped = gradeHistoryIds.length - validIds.length;

  if (validIds.length === 0) {
    return NextResponse.json(
      { error: "None of the selected students are eligible (already decided, or not at this school)." },
      { status: 400 }
    );
  }

  const decided = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const gradeHistoryId of validIds) {
      const r = await recordGradeDecision(
        {
          gradeHistoryId,
          newStatus: status as GradeHistoryStatus,
          newOutcomeGradeId: needsOutcome ? outcomeSchoolGradeId! : null,
          changedByUserId: userId,
        },
        tx
      );
      out.push(r);
    }
    return out;
  });

  return NextResponse.json({ ok: true, decided: decided.length, skipped });
}
