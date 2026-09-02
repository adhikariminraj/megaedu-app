import { prisma } from "@/lib/prisma";

export type NotificationType =
  | "SCHOOL_ANNOUNCEMENT"
  | "STAFF_APPROVED"
  | "STUDENT_APPROVED"
  | "CERTIFICATE_ISSUED"
  | "SCHOOL_VERIFIED"
  | "ORGANIZATION_VERIFIED";

export async function notify(userId: string, type: NotificationType, title: string, body?: string) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body } });
  } catch (err) {
    // Notifications are a nice-to-have — never let a failure here break
    // the actual action (approving someone, posting news, etc.).
    console.error("Failed to create notification:", err);
  }
}

/**
 * Notify every approved teacher and student at a school — used when a
 * school posts a new announcement/news item.
 */
export async function notifySchoolCommunity(schoolId: string, title: string, body?: string) {
  const [teachers, students] = await Promise.all([
    prisma.teacher.findMany({ where: { schoolId, approved: true }, select: { userId: true } }),
    prisma.student.findMany({ where: { schoolId, approved: true }, select: { userId: true } }),
  ]);
  // Only reaches people who actually have a MEGA account to be notified
  // on — a User-less institutional Student/Teacher has nowhere for a
  // notification to go, so they're silently skipped here, not an error.
  const userIds = [...teachers.map((t) => t.userId), ...students.map((s) => s.userId)].filter(
    (id): id is string => id !== null
  );
  await Promise.all(
    userIds.map((userId) => notify(userId, "SCHOOL_ANNOUNCEMENT", title, body))
  );
}
