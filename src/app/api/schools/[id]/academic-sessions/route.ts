import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Creates a school's AcademicSession. Enforces "a school may have at
 * most one ACTIVE session at a time" at the application level, since
 * SQLite can't express a partial unique index for this — see
 * docs/PRODUCT_RULES.md.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existingActive = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (existingActive) {
    return NextResponse.json({ ok: true, session: existingActive, alreadyActive: true });
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

  const session = await prisma.academicSession.create({
    data: { schoolId: params.id, name: name.trim(), startDate: start, endDate: end, status: "ACTIVE" },
  });

  return NextResponse.json({ ok: true, session });
}
