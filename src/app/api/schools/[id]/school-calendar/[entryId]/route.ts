import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { resolveSchoolCalendarEntryDates, SCHOOL_CALENDAR_CATEGORIES } from "@/lib/schoolCalendar";

/**
 * Edit and/or deactivate a SchoolCalendarEntry — School Admin only.
 * Mirrors /api/schools/[id]/events/[eventId]/route.ts exactly: re-
 * verifies the row's own schoolId against the URL's schoolId (defense
 * against a forged cross-school entryId), and there is no DELETE route
 * — isActive:false is the only removal path.
 *
 * If `category` changes (or stays the same but dates are being edited),
 * the date shape is re-validated and affectsDayStatus is re-derived —
 * never accepted from the client — exactly as on create.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const entry = await prisma.schoolCalendarEntry.findUnique({ where: { id: params.entryId } });
  if (!entry || entry.schoolId !== params.id) {
    return NextResponse.json({ error: "Calendar entry not found." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;

  const category = typeof body.category === "string" ? body.category : entry.category;
  if (typeof body.category === "string" && !SCHOOL_CALENDAR_CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const datesChanged = body.category !== undefined || body.date !== undefined || body.startDate !== undefined || body.endDate !== undefined;
  if (datesChanged) {
    const fallbackBody = {
      date: body.date ?? entry.startDate.toISOString().slice(0, 10),
      startDate: body.startDate ?? entry.startDate.toISOString().slice(0, 10),
      endDate: body.endDate ?? entry.endDate.toISOString().slice(0, 10),
    };
    const resolved = resolveSchoolCalendarEntryDates(category, fallbackBody);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    data.category = category;
    data.affectsDayStatus = resolved.affectsDayStatus;
    data.startDate = resolved.startDate;
    data.endDate = resolved.endDate;
  }

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.schoolCalendarEntry.update({ where: { id: params.entryId }, data });
  return NextResponse.json({ ok: true, entry: updated });
}
