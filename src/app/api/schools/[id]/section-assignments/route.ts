import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { reassignSection } from "@/lib/gradeHistory";

/**
 * Bulk-assigns/reassigns the section on EXISTING GradeHistory rows —
 * whether filling in a previously-null section or genuinely moving
 * students between sections. Every row goes through reassignSection()
 * inside one transaction, so each change is audited (see
 * docs/PRODUCT_RULES.md) — this is the only route allowed to change
 * sectionId on a row that already exists; grade-placements only ever
 * sets it at creation time.
 *
 * A null sectionId is valid — it means "unassign", also audited.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gradeHistoryIds, sectionId } = (await req.json()) as {
    gradeHistoryIds?: string[];
    sectionId?: string | null;
  };
  if (!gradeHistoryIds?.length) {
    return NextResponse.json({ error: "Select at least one student." }, { status: 400 });
  }

  let targetSection: { id: string; schoolGradeId: string } | null = null;
  if (sectionId) {
    const section = await prisma.section.findUnique({ where: { id: sectionId } });
    if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });
    if (!section.isActive) {
      return NextResponse.json({ error: "This section is deactivated." }, { status: 400 });
    }
    targetSection = { id: section.id, schoolGradeId: section.schoolGradeId };
  }

  const rows = await prisma.gradeHistory.findMany({
    where: { id: { in: gradeHistoryIds } },
    include: { schoolGrade: true },
  });
  const validIds = rows
    .filter(
      (r) =>
        r.schoolGrade.schoolId === params.id &&
        (!targetSection || r.schoolGradeId === targetSection.schoolGradeId)
    )
    .map((r) => r.id);
  const skipped = gradeHistoryIds.length - validIds.length;

  if (validIds.length === 0) {
    return NextResponse.json(
      { error: "None of the selected students are eligible (wrong school, or the section doesn't belong to their grade)." },
      { status: 400 }
    );
  }

  const reassigned = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const gradeHistoryId of validIds) {
      const r = await reassignSection(
        { gradeHistoryId, newSectionId: sectionId || null, changedByUserId: userId },
        tx
      );
      out.push(r);
    }
    return out;
  });

  return NextResponse.json({ ok: true, reassigned: reassigned.length, skipped });
}
