import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireClassTeacher } from "@/lib/authorize";
import { ATTENDANCE_STATUSES, correctAttendance } from "@/lib/attendance";

/**
 * Corrects an already-marked Attendance row's status and/or remarks —
 * the only way either field changes on an existing row. Authorization
 * scope is resolved from the ATTENDANCE ROW ITSELF (its own
 * academicSessionId/schoolGradeId/sectionId), never from client input,
 * so a caller can't claim a different scope than the record actually
 * belongs to.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; attendanceId: string } }
) {
  const attendance = await prisma.attendance.findUnique({ where: { id: params.attendanceId } });
  if (!attendance) {
    return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
  }
  // Confirm this attendance row actually belongs to this school before
  // trusting its own scope for the authorization check below.
  const grade = await prisma.schoolGrade.findUnique({ where: { id: attendance.schoolGradeId } });
  if (!grade || grade.schoolId !== params.id) {
    return NextResponse.json({ error: "Attendance record not found." }, { status: 404 });
  }

  const [adminUserId, classTeacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireClassTeacher(params.id, {
      academicSessionId: attendance.academicSessionId,
      schoolGradeId: attendance.schoolGradeId,
      sectionId: attendance.sectionId,
    }),
  ]);
  const userId = adminUserId || classTeacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { status?: string; remarks?: string | null };
  if (body.status !== undefined && !ATTENDANCE_STATUSES.includes(body.status as any)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (body.status === undefined && body.remarks === undefined) {
    return NextResponse.json({ error: "Nothing to correct." }, { status: 400 });
  }

  const { attendance: updated } = await correctAttendance({
    attendanceId: params.attendanceId,
    newStatus: body.status as any,
    newRemarks: body.remarks,
    changedByUserId: userId,
  });

  return NextResponse.json({ ok: true, attendance: updated });
}
