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
