import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSchoolAdmin,
  requireTeacherAssignment,
  requireClassTeacher,
  teacherHoldsSubjectAssignment,
  teacherHoldsClassAssignment,
} from "@/lib/authorize";

/**
 * Creates a StudentEvaluation for the student's current placement in
 * the active academic session — General Student Evaluation
 * (gradeSubjectId omitted, authored by a Grade Coordinator/Class Teacher)
 * or Subject Evaluation (gradeSubjectId set, authored by that subject's
 * Teacher). "General" vs "Subject" is derived entirely from whether
 * gradeSubjectId is set — there is no separate type field.
 *
 * A School Admin may create one "on behalf of" a named teacher
 * (teacherId in the body, validated to actually hold the matching
 * assignment) — mirroring every other Phase 3 write route's School
 * Admin/Teacher parity. A Teacher acting on their own behalf has
 * teacherId resolved from their own session; any teacherId they pass in
 * the body is ignored.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student || student.schoolId !== params.id) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: params.id, status: "ACTIVE" },
  });
  if (!activeSession) {
    return NextResponse.json({ error: "No active academic session." }, { status: 400 });
  }

  const placement = await prisma.gradeHistory.findFirst({
    where: { studentId: params.studentId, academicSessionId: activeSession.id },
  });
  if (!placement) {
    return NextResponse.json(
      { error: "This student has no grade placement for the active session." },
      { status: 400 }
    );
  }

  const body = (await req.json()) as {
    teacherId?: string;
    gradeSubjectId?: string;
    remarks?: string;
  };
  if (!body.remarks?.trim()) {
    return NextResponse.json({ error: "Remarks are required." }, { status: 400 });
  }

  let subjectId: string | undefined;
  if (body.gradeSubjectId) {
    const gradeSubject = await prisma.gradeSubject.findUnique({ where: { id: body.gradeSubjectId } });
    if (
      !gradeSubject ||
      gradeSubject.schoolGradeId !== placement.schoolGradeId ||
      gradeSubject.academicSessionId !== activeSession.id
    ) {
      return NextResponse.json(
        { error: "Invalid subject for this student's current placement." },
        { status: 400 }
      );
    }
    subjectId = gradeSubject.subjectId;
  }

  const scope = {
    academicSessionId: activeSession.id,
    schoolGradeId: placement.schoolGradeId,
    sectionId: placement.sectionId,
  };

  const [adminUserId, teacherSelfUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    subjectId
      ? requireTeacherAssignment(params.id, { ...scope, subjectId })
      : requireClassTeacher(params.id, scope),
  ]);

  let teacherId: string | null = null;
  let actingUserId: string | null = null;

  if (teacherSelfUserId) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId: teacherSelfUserId, schoolId: params.id, approved: true },
    });
    if (teacher) {
      teacherId = teacher.id;
      actingUserId = teacherSelfUserId;
    }
  }

  if (!teacherId && adminUserId) {
    if (!body.teacherId) {
      return NextResponse.json(
        { error: "Select which teacher this evaluation is attributed to." },
        { status: 400 }
      );
    }
    const namedTeacher = await prisma.teacher.findUnique({ where: { id: body.teacherId } });
    if (!namedTeacher || namedTeacher.schoolId !== params.id) {
      return NextResponse.json({ error: "Invalid teacher." }, { status: 400 });
    }
    const holds = subjectId
      ? await teacherHoldsSubjectAssignment(body.teacherId, { ...scope, subjectId })
      : await teacherHoldsClassAssignment(body.teacherId, scope);
    if (!holds) {
      return NextResponse.json(
        { error: "That teacher doesn't hold a matching assignment for this student." },
        { status: 400 }
      );
    }
    teacherId = body.teacherId;
    actingUserId = adminUserId;
  }

  if (!teacherId || !actingUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Same NULL ≠ NULL unique-index gap already found and fixed twice
  // elsewhere in this schema (TeacherAcademicAssignment,
  // ClassTeacherAssignment) — @@unique alone won't catch a second
  // general (gradeSubjectId: null) evaluation, so pre-check explicitly.
  const existing = await prisma.studentEvaluation.findFirst({
    where: {
      studentId: params.studentId,
      teacherId,
      academicSessionId: activeSession.id,
      gradeSubjectId: body.gradeSubjectId || null,
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This teacher already has an evaluation for this student, this session, in this scope. Edit it instead." },
      { status: 409 }
    );
  }

  const evaluation = await prisma.studentEvaluation.create({
    data: {
      studentId: params.studentId,
      teacherId,
      academicSessionId: activeSession.id,
      schoolGradeId: placement.schoolGradeId,
      sectionId: placement.sectionId,
      gradeSubjectId: body.gradeSubjectId || null,
      remarks: body.remarks.trim(),
      createdByUserId: actingUserId,
    },
  });

  return NextResponse.json({ ok: true, evaluation });
}
