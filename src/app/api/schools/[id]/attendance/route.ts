import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireClassTeacher } from "@/lib/authorize";
import { ATTENDANCE_STATUSES } from "@/lib/attendance";

type AttendanceRecordInput = { studentId: string; status: string; remarks?: string | null };

/**
 * Bulk-marks attendance for one date, for students in one grade (or one
 * section of it). One row per student per calendar day — never
 * subject-based. `date` must be a "YYYY-MM-DD" string; converted via
 * `new Date(date)`, the same convention already used for
 * AcademicSession.startDate/endDate, giving a consistent UTC-midnight
 * value regardless of server timezone. The caller (never the server)
 * is the source of "today."
 *
 * `sectionId` in the request body is the TARGET of this marking pass —
 * omit it (or pass null) to mark across the whole grade (requires a
 * Grade Coordinator, not just a Class Teacher — see
 * requireClassTeacher()'s three-way section semantics); pass a real
 * section id to mark just that section's roster (a Grade Coordinator
 * or that section's own Class Teacher may both do this).
 *
 * Each record's actual schoolGradeId/sectionId snapshot on the
 * Attendance row is taken from the STUDENT's own current GradeHistory
 * placement, never blindly from client input — a student whose
 * placement doesn't match the target grade/section is skipped, not
 * silently recorded against the wrong class.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { academicSessionId, schoolGradeId, sectionId, date, records } = (await req.json()) as {
    academicSessionId?: string;
    schoolGradeId?: string;
    sectionId?: string | null;
    date?: string;
    records?: AttendanceRecordInput[];
  };
  if (!academicSessionId || !schoolGradeId || !date || !records?.length) {
    return NextResponse.json({ error: "Missing required attendance fields." }, { status: 400 });
  }

  const targetSectionId = sectionId || null;
  const [adminUserId, classTeacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireClassTeacher(params.id, { academicSessionId, schoolGradeId, sectionId: targetSectionId }),
  ]);
  const userId = adminUserId || classTeacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const attendanceDate = new Date(date);
  if (isNaN(attendanceDate.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const studentIds = records.map((r) => r.studentId);
  const placements = await prisma.gradeHistory.findMany({
    where: { studentId: { in: studentIds }, academicSessionId },
    select: { studentId: true, schoolGradeId: true, sectionId: true },
  });
  const placementByStudent = new Map(placements.map((p) => [p.studentId, p]));

  const { created, skipped } = await prisma.$transaction(async (tx) => {
    let created = 0;
    let skipped = 0;
    for (const r of records) {
      if (!ATTENDANCE_STATUSES.includes(r.status as any)) {
        skipped++;
        continue;
      }
      const placement = placementByStudent.get(r.studentId);
      if (!placement || placement.schoolGradeId !== schoolGradeId) {
        skipped++; // not enrolled in this grade this session
        continue;
      }
      if (targetSectionId && placement.sectionId !== targetSectionId) {
        skipped++; // not in the section this marking pass targets
        continue;
      }
      try {
        await tx.attendance.create({
          data: {
            studentId: r.studentId,
            academicSessionId,
            schoolGradeId: placement.schoolGradeId,
            sectionId: placement.sectionId,
            date: attendanceDate,
            status: r.status,
            remarks: r.remarks || null,
            markedByUserId: userId,
          },
        });
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // already marked for this student on this date
          continue;
        }
        throw err;
      }
    }
    return { created, skipped };
  });

  return NextResponse.json({ ok: true, created, skipped });
}
