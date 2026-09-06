import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { kathmanduInstant } from "@/lib/calendar";

/**
 * School Event creation — Calendar K1. Mirrors
 * /api/schools/[id]/opportunities/route.ts's exact shape (School-Admin-
 * only, schoolId from the URL, no additional validation library) —
 * this is the closest existing precedent, not a new pattern. Teacher
 * creation is deliberately not authorized here — nothing in this
 * schema's existing content models (NewsPost, Program) authorizes
 * Teacher-authored school-wide content either.
 *
 * organizationId is never accepted from the client — Organization
 * Events remain out of scope for this kilometer.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, date, time, isAllDay, location, onlineUrl } = await req.json();

  if (!title?.trim() || !date?.trim()) {
    return NextResponse.json({ error: "Title and date are required." }, { status: 400 });
  }
  const allDay = isAllDay !== false;
  if (!allDay && !time?.trim()) {
    return NextResponse.json({ error: "A time is required for a timed event." }, { status: 400 });
  }

  const startsAt = kathmanduInstant(date, allDay ? null : time);
  if (isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid date or time." }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      schoolId: params.id,
      title: title.trim(),
      description: description?.trim() || null,
      startsAt,
      isAllDay: allDay,
      location: location?.trim() || null,
      onlineUrl: onlineUrl?.trim() || null,
      createdByUserId: userId,
    },
  });

  return NextResponse.json({ ok: true, event });
}
