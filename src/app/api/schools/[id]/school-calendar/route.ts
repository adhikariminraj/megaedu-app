import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { resolveSchoolCalendarEntryDates, SCHOOL_CALENDAR_CATEGORIES } from "@/lib/schoolCalendar";

/**
 * SchoolCalendarEntry creation — Calendar K1.1. Mirrors
 * /api/schools/[id]/events/route.ts's shape (School-Admin-only, schoolId
 * from the URL). affectsDayStatus is never read from the client body —
 * resolveSchoolCalendarEntryDates() derives it (and validates the
 * date shape) purely from `category`, so an Admin can never produce an
 * invalid combination like PTM + affectsDayStatus:true.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, category, description } = body;

  if (!title?.trim() || !category) {
    return NextResponse.json({ error: "Title and category are required." }, { status: 400 });
  }
  if (!SCHOOL_CALENDAR_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const resolved = resolveSchoolCalendarEntryDates(category, body);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const entry = await prisma.schoolCalendarEntry.create({
    data: {
      schoolId: params.id,
      title: title.trim(),
      category,
      affectsDayStatus: resolved.affectsDayStatus,
      startDate: resolved.startDate,
      endDate: resolved.endDate,
      description: description?.trim() || null,
      createdByUserId: userId,
    },
  });

  return NextResponse.json({ ok: true, entry });
}
