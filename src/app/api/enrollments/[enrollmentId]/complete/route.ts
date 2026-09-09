import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { issueCourseCertificate } from "@/lib/certificates";

export async function POST(_req: Request, { params }: { params: { enrollmentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { id: params.enrollmentId },
    include: {
      user: true,
      teacher: { include: { school: true } },
      student: { include: { school: true } },
      certificate: true,
      course: { include: { organization: true, instructor: true } },
    },
  });
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Academy Participation kilometer — ownership is the enrollment's own
  // direct userId, never re-derived through Teacher/Student. Certificate
  // architecture (issueCourseCertificate(), recipientUserId) is
  // untouched — it already spoke User.id natively; only the recipient
  // lookup below changes, from Teacher/Student to the direct relation.
  const owns = enrollment.userId === userId;
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (enrollment.certificate) {
    return NextResponse.json({ ok: true, alreadyCompleted: true, certificate: enrollment.certificate });
  }

  const recipient = enrollment.user;
  // associatedSchool remains an optional, purely informational
  // enrichment — present only when the enrollee also currently holds a
  // Teacher or Student profile with a school; absent (not an error) for
  // a Parent/Org Admin/unaffiliated learner, exactly as it already was.
  const associatedSchool = enrollment.teacher?.school || enrollment.student?.school;

  // Marking the enrollment complete and issuing its certificate happen
  // together, atomically — an enrollment should never end up "complete"
  // with no certificate, or vice versa.
  const [updatedEnrollment, certificate] = await prisma.$transaction(async (tx) => {
    const updated = await tx.courseEnrollment.update({
      where: { id: params.enrollmentId },
      data: { progress: 100, completedAt: new Date() },
    });

    const cert = await issueCourseCertificate(
      {
        enrollmentId: params.enrollmentId,
        recipientUserId: recipient.id,
        recipientName: recipient.name,
        courseTitle: enrollment.course.title,
        organizationId: enrollment.course.organizationId,
        organizationName: enrollment.course.organization?.name,
        instructorId: enrollment.course.instructorId,
        instructorName: enrollment.course.instructor?.name,
        associatedSchoolId: associatedSchool?.id,
        associatedSchoolName: associatedSchool?.name,
      },
      tx
    );

    return [updated, cert] as const;
  });

  await notify(
    userId,
    "CERTIFICATE_ISSUED",
    `Certificate earned: ${enrollment.course.title}`,
    "Congratulations on completing the course! Your certificate is ready to view and share."
  );

  return NextResponse.json({ ok: true, enrollment: updatedEnrollment, certificate });
}
