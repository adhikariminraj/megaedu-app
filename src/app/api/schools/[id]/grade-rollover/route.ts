import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { carryForwardEligibleStudents } from "@/lib/gradeRollover";

/**
 * On-demand re-run of the carry-forward sweep against the current
 * active session. Exists so resolving a previously-pending student
 * (recording their missing decision on the old row) actually gets them
 * placed into the new session without waiting for the next rollover —
 * "before that student gets a grade in the new session" is something a
 * School Admin can trigger the moment they've resolved someone, not
 * only automatically at rollover time.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (!activeSession) {
    return NextResponse.json({ error: "No active session." }, { status: 400 });
  }

  const { placed } = await prisma.$transaction((tx) =>
    carryForwardEligibleStudents(params.id, activeSession.id, tx)
  );

  return NextResponse.json({ ok: true, placed });
}
