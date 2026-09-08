import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/authorize";
import { transitionAcademicSession, academicSessionTransitionErrorResponse } from "@/lib/academicSession";

/**
 * Creates a school's AcademicSession. "A school may have at most one
 * ACTIVE session at a time" is enforced by transitionAcademicSession()
 * (src/lib/academicSession.ts) — the existence check and the create
 * happen inside one transaction there, never here, and never outside a
 * transaction at all (see that module's own comment for why this
 * matters on SQLite specifically).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  try {
    const result = await transitionAcademicSession({
      mode: "CREATE_IF_NONE_ACTIVE",
      schoolId: params.id,
      name: name.trim(),
      startDate: start,
      endDate: end,
    });
    return NextResponse.json({
      ok: true,
      session: result.session,
      ...(result.wasAlreadyActive ? { alreadyActive: true } : {}),
    });
  } catch (err) {
    return academicSessionTransitionErrorResponse(err);
  }
}
