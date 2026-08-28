import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { carryForwardEligibleStudents } from "@/lib/gradeRollover";

/**
 * Closes the school's current ACTIVE session and opens a new one, then
 * sweeps every eligible student (most recent decision was
 * COMPLETED/REPEATED with a real outcome grade) into the new session.
 * Anyone still ENROLLED with no decision is deliberately left
 * unplaced — never silently defaulted — and shows up in the persistent
 * Pending/Unresolved queue on /dashboard/grades until a School Admin
 * resolves them.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const priorSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (!priorSession) {
    return NextResponse.json(
      { error: "No active session to close. Complete Initial Setup first." },
      { status: 400 }
    );
  }

  const { name, startDate, endDate } = await req.json();
  if (!name?.trim() || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Session name, start date, and end date are all required." },
      { status: 400 }
    );
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.academicSession.update({ where: { id: priorSession.id }, data: { status: "CLOSED" } });
    const newSession = await tx.academicSession.create({
      data: { schoolId: params.id, name: name.trim(), startDate: start, endDate: end, status: "ACTIVE" },
    });
    const { placed } = await carryForwardEligibleStudents(params.id, newSession.id, tx);
    return { newSession, placed };
  });

  return NextResponse.json({ ok: true, session: result.newSession, placed: result.placed });
}
