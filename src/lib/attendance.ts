import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

type CorrectAttendanceInput = {
  attendanceId: string;
  newStatus?: AttendanceStatus;
  newRemarks?: string | null;
  changedByUserId: string;
};

/**
 * The only code path allowed to change an already-marked Attendance
 * row's status/remarks. Every call updates the row AND inserts an
 * AttendanceAudit row capturing a full previous/new snapshot of BOTH
 * fields in the same transaction — even a remarks-only edit records
 * status unchanged, and vice versa — so nothing is ever silently
 * overwritten. Mirrors reassignSection()'s shape exactly.
 *
 * Only fields actually passed are changed; omitting newStatus or
 * newRemarks leaves that field as it was.
 */
export async function correctAttendance(
  input: CorrectAttendanceInput,
  tx?: Prisma.TransactionClient
) {
  if (input.newStatus && !ATTENDANCE_STATUSES.includes(input.newStatus)) {
    throw new Error(`Invalid Attendance status: ${input.newStatus}`);
  }

  const run = async (client: Prisma.TransactionClient) => {
    const current = await client.attendance.findUniqueOrThrow({
      where: { id: input.attendanceId },
    });

    const newStatus = input.newStatus ?? current.status;
    const newRemarks = input.newRemarks !== undefined ? input.newRemarks : current.remarks;

    const attendance = await client.attendance.update({
      where: { id: input.attendanceId },
      data: { status: newStatus, remarks: newRemarks },
    });

    const audit = await client.attendanceAudit.create({
      data: {
        attendanceId: input.attendanceId,
        changedByUserId: input.changedByUserId,
        previousStatus: current.status,
        newStatus,
        previousRemarks: current.remarks,
        newRemarks,
      },
    });

    return { attendance, audit };
  };

  if (tx) return run(tx);
  return prisma.$transaction((txClient) => run(txClient));
}

export type AttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  excused: number;
  // (present + late) / (present + late + absent) * 100 — Present and
  // Late both count as attended; Absent is the only outcome counted
  // against the student; Excused is removed from both sides entirely,
  // the same "never counted against a student" principle
  // computeHomeworkRollup() (homeworkRollup.ts) already applies to its
  // own Excused rows. null — never a manufactured 0% — when there is no
  // attendance data to compute from.
  attendancePercentage: number | null;
};

/**
 * Student-level attendance summary for one academic session, for the
 * Student Profile's Academic Snapshot. academicSessionId is the
 * caller's responsibility to resolve correctly (e.g. via
 * resolveCurrentPlacement() in gradeHistory.ts) — this function does no
 * placement resolution of its own, matching every other summary
 * function in this codebase.
 */
export async function computeAttendanceSummary(
  studentId: string,
  academicSessionId: string
): Promise<AttendanceSummary> {
  const rows = await prisma.attendance.findMany({
    where: { studentId, academicSessionId },
    select: { status: true },
  });

  let present = 0,
    absent = 0,
    late = 0,
    excused = 0;

  for (const row of rows) {
    switch (row.status) {
      case "PRESENT":
        present++;
        break;
      case "ABSENT":
        absent++;
        break;
      case "LATE":
        late++;
        break;
      case "EXCUSED":
        excused++;
        break;
    }
  }

  const denominator = present + late + absent;
  const attendancePercentage = denominator > 0 ? ((present + late) / denominator) * 100 : null;

  return { present, absent, late, excused, attendancePercentage };
}
