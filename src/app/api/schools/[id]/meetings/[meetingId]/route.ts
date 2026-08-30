import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];

/**
 * Updates a meeting's status/outcomeNotes/linkedEvaluationId. Authorized
 * by identity, not re-derived scope: a School Admin, or specifically
 * the teacher this meeting's own teacherId names — since the row
 * already captures a committed relationship, there's no need to
 * re-verify the teacher still holds a matching assignment the way
 * creation does.
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
      const teacher = await prisma.teacher.findFirst({
        where: { userId: sessionUserId, schoolId: params.id, approved: true },
      });
      if (teacher && teacher.id === meeting.teacherId) authorized = true;
    }
  }
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    status?: string;
    outcomeNotes?: string;
    linkedEvaluationId?: string | null;
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

  const updated = await prisma.parentTeacherMeeting.update({
    where: { id: params.meetingId },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.outcomeNotes !== undefined ? { outcomeNotes: body.outcomeNotes } : {}),
      ...(body.linkedEvaluationId !== undefined ? { linkedEvaluationId: body.linkedEvaluationId || null } : {}),
    },
  });

  return NextResponse.json({ ok: true, meeting: updated });
}
