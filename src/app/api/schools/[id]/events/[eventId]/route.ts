import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { kathmanduInstant } from "@/lib/calendar";

/**
 * Edit and/or deactivate a School Event — School Admin only. No DELETE
 * route: deactivation (isActive: false) is how a wrongly-created or
 * cancelled Event is removed from Calendar, matching Section/Subject/
 * FamilyContact's existing soft-deactivate convention — the record
 * itself is never dropped.
 *
 * Re-verifies the Event's own schoolId against the URL's schoolId
 * before allowing any change — defense in depth against a forged
 * cross-school eventId, the same pattern already used by Homework's
 * PATCH route.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; eventId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event || event.schoolId !== params.id) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    if (!body.title.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.location === "string") data.location = body.location.trim() || null;
  if (typeof body.onlineUrl === "string") data.onlineUrl = body.onlineUrl.trim() || null;

  if (body.date !== undefined || body.time !== undefined || body.isAllDay !== undefined) {
    const allDay = body.isAllDay !== undefined ? body.isAllDay !== false : event.isAllDay;
    const date = typeof body.date === "string" ? body.date : event.startsAt.toISOString().slice(0, 10);
    const time = typeof body.time === "string" ? body.time : null;
    if (!allDay && !time) {
      return NextResponse.json({ error: "A time is required for a timed event." }, { status: 400 });
    }
    const startsAt = kathmanduInstant(date, allDay ? null : time);
    if (isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
    }
    data.startsAt = startsAt;
    data.isAllDay = allDay;
  }

  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.event.update({ where: { id: params.eventId }, data });
  return NextResponse.json({ ok: true, event: updated });
}
