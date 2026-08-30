import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, teacherHoldsSubjectAssignment, teacherHoldsClassAssignment } from "@/lib/authorize";

type MeetingInput = {
  studentId: string;
  teacherId?: string;
  gradeSubjectId?: string;
  scheduledAt: string;
  location?: string;
  onlineUrl?: string;
};

/**
 * Bulk-creates ParentTeacherMeeting rows — a single request handles
 * both an occasional (one item) and a periodic (many items, e.g. a PTM
 * week for a whole grade) meeting the same way; the only difference is
 * how many items the caller submits. Every item is resolved and
 * validated BEFORE the transaction opens (the Postgres-safe pattern
 * already used by grade-decisions/the rollover sweep) — not the
 * SQLite-only catch-mid-transaction pattern used elsewhere in this
 * schema, since this route may run against Postgres in production.
 *
 * A School Admin may schedule on behalf of any teacher who actually
 * holds a matching assignment (teacherId required per item); a Teacher
 * scheduling their own meetings has teacherId resolved from their own
 * session — an explicit teacherId in the body is only honored if it
 * matches their own Teacher.id.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  if (!sessionUserId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const adminUserId = await requireSchoolAdmin(params.id);
  const selfTeacher = await prisma.teacher.findFirst({
    where: { userId: sessionUserId, schoolId: params.id, approved: true },
  });
  if (!adminUserId && !selfTeacher) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { meetings } = (await req.json()) as { meetings?: MeetingInput[] };
  if (!meetings?.length) {
    return NextResponse.json({ error: "At least one meeting is required." }, { status: 400 });
  }

  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (!activeSession) {
    return NextResponse.json({ error: "No active academic session." }, { status: 400 });
  }

  const placements = await prisma.gradeHistory.findMany({
    where: { studentId: { in: meetings.map((m) => m.studentId) }, academicSessionId: activeSession.id },
  });
  const placementByStudent = new Map(placements.map((p) => [p.studentId, p]));

  const toCreate: {
    studentId: string;
    teacherId: string;
    gradeSubjectId: string | null;
    scheduledAt: Date;
    location: string | null;
    onlineUrl: string | null;
  }[] = [];
  let skipped = 0;

  for (const m of meetings) {
    const placement = placementByStudent.get(m.studentId);
    if (!placement) {
      skipped++;
      continue;
    }
    const scheduledAt = new Date(m.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      skipped++;
      continue;
    }

    let subjectId: string | undefined;
    if (m.gradeSubjectId) {
      const gradeSubject = await prisma.gradeSubject.findUnique({ where: { id: m.gradeSubjectId } });
      if (
        !gradeSubject ||
        gradeSubject.schoolGradeId !== placement.schoolGradeId ||
        gradeSubject.academicSessionId !== activeSession.id
      ) {
        skipped++;
        continue;
      }
      subjectId = gradeSubject.subjectId;
    }

    const scope = {
      academicSessionId: activeSession.id,
      schoolGradeId: placement.schoolGradeId,
      sectionId: placement.sectionId,
    };

    let teacherId: string | null = null;
    if (selfTeacher && (!m.teacherId || m.teacherId === selfTeacher.id)) {
      const holds = subjectId
        ? await teacherHoldsSubjectAssignment(selfTeacher.id, { ...scope, subjectId })
        : await teacherHoldsClassAssignment(selfTeacher.id, scope);
      if (holds) teacherId = selfTeacher.id;
    } else if (adminUserId && m.teacherId) {
      const holds = subjectId
        ? await teacherHoldsSubjectAssignment(m.teacherId, { ...scope, subjectId })
        : await teacherHoldsClassAssignment(m.teacherId, scope);
      if (holds) teacherId = m.teacherId;
    }

    if (!teacherId) {
      skipped++;
      continue;
    }

    toCreate.push({
      studentId: m.studentId,
      teacherId,
      gradeSubjectId: m.gradeSubjectId || null,
      scheduledAt,
      location: m.location || null,
      onlineUrl: m.onlineUrl || null,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json(
      { error: "None of the requested meetings could be scheduled." },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(
    toCreate.map((m) =>
      prisma.parentTeacherMeeting.create({
        data: {
          schoolId: params.id,
          academicSessionId: activeSession.id,
          studentId: m.studentId,
          teacherId: m.teacherId,
          gradeSubjectId: m.gradeSubjectId,
          scheduledAt: m.scheduledAt,
          location: m.location,
          onlineUrl: m.onlineUrl,
          createdByUserId: sessionUserId,
        },
      })
    )
  );

  return NextResponse.json({ ok: true, created: created.length, skipped });
}
