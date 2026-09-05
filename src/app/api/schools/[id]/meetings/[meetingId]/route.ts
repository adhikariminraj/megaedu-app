import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];

/**
 * Updates a meeting's status/outcomeNotes/linkedEvaluationId, and/or
 * reschedules it (scheduledAt/location/onlineUrl). Authorized by
 * identity, not re-derived scope: a School Admin, or specifically the
 * teacher this meeting's own teacherId names — since the row already
 * captures a committed relationship, there's no need to re-verify the
 * teacher still holds a matching assignment the way creation does.
 *
 * Rescheduling is only allowed while the meeting is still SCHEDULED —
 * a COMPLETED or CANCELLED meeting's original details become
 * historical record, not editable. Rescheduling is not audited (only
 * StudentEvaluation.remarks has that requirement in this phase).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; meetingId: string } }
) {
  const meeting = await prisma.parentTeacherMeeting.findUnique({ where: { id: params.meetingId } });
  if (!meeting || meeting.schoolId !== params.id) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const adminUserId = await requireSchoolAdmin(params.id);
  let authorized = !!adminUserId;

  if (!authorized) {
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.id as string | undefined;
    if (sessionUserId) {
      // Phase 4D-3: teacher identity resolved via userId alone, then
      // confirmed via an ACTIVE TeacherSchoolAffiliation at this
      // specific schoolId — not the Teacher.schoolId/approved bridge.
      const teacher = await prisma.teacher.findUnique({ where: { userId: sessionUserId } });
      if (teacher && teacher.id === meeting.teacherId) {
        const affiliation = await prisma.teacherSchoolAffiliation.findFirst({
          where: { teacherId: teacher.id, schoolId: params.id, status: "ACTIVE" },
        });
        if (affiliation) authorized = true;
      }
    }
  }
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    status?: string;
    outcomeNotes?: string;
    linkedEvaluationId?: string | null;
    scheduledAt?: string;
    location?: string | null;
    onlineUrl?: string | null;
  };

  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (body.linkedEvaluationId) {
    const evaluation = await prisma.studentEvaluation.findUnique({ where: { id: body.linkedEvaluationId } });
    if (!evaluation || evaluation.studentId !== meeting.studentId) {
      return NextResponse.json(
        { error: "Invalid evaluation to link — must belong to the same student." },
        { status: 400 }
      );
    }
  }

  const isRescheduling =
    body.scheduledAt !== undefined || body.location !== undefined || body.onlineUrl !== undefined;
  let parsedScheduledAt: Date | undefined;
  if (isRescheduling) {
    if (meeting.status !== "SCHEDULED") {
      return NextResponse.json(
        { error: "Only a still-scheduled meeting can be rescheduled." },
        { status: 400 }
      );
    }
    if (body.scheduledAt !== undefined) {
      parsedScheduledAt = new Date(body.scheduledAt);
      if (isNaN(parsedScheduledAt.getTime())) {
        return NextResponse.json({ error: "Invalid date/time." }, { status: 400 });
      }
    }
  }

  const updated = await prisma.parentTeacherMeeting.update({
    where: { id: params.meetingId },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.outcomeNotes !== undefined ? { outcomeNotes: body.outcomeNotes } : {}),
      ...(body.linkedEvaluationId !== undefined ? { linkedEvaluationId: body.linkedEvaluationId || null } : {}),
      ...(parsedScheduledAt ? { scheduledAt: parsedScheduledAt } : {}),
      ...(body.location !== undefined ? { location: body.location || null } : {}),
      ...(body.onlineUrl !== undefined ? { onlineUrl: body.onlineUrl || null } : {}),
    },
  });

  return NextResponse.json({ ok: true, meeting: updated });
}
