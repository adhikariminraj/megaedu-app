import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";
import { kathmanduInstant } from "@/lib/calendar";

/**
 * Organization Event creation — A7. Mirrors
 * schools/[id]/events/route.ts's exact shape (Organization-Admin-only,
 * organizationId from the URL, never accepted from the client body).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
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
      organizationId: params.id,
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
