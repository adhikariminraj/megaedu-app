import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type IssueCourseCertificateInput = {
  enrollmentId: string;
  recipientUserId: string;
  recipientName: string;
  courseTitle: string;
  organizationId?: string | null;
  organizationName?: string | null;
  instructorId?: string | null;
  instructorName?: string | null;
  associatedSchoolId?: string | null;
  associatedSchoolName?: string | null;
};

/**
 * Issues a certificate for a completed MEGA Academy course. This is the
 * only place that should ever create a Certificate row — it's what
 * guarantees the snapshot fields are always filled in at issuance time,
 * so a later course rename, organization rename, or profile change can
 * never silently alter a certificate that's already been issued.
 *
 * Accepts an optional transaction client (`tx`) so the caller can run
 * this atomically alongside marking the enrollment complete — pass the
 * callback argument from prisma.$transaction(async (tx) => {...}).
 *
 * Phase 2 will add a parallel issueGradeCertificate() function once
 * GradeHistory exists — this function stays scoped to course
 * completions only.
 */
export async function issueCourseCertificate(
  input: IssueCourseCertificateInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.certificate.create({
    data: {
      recipientUserId: input.recipientUserId,
      enrollmentId: input.enrollmentId,
      instructorId: input.instructorId || null,
      issuerType: "ORGANIZATION",
      issuerOrganizationId: input.organizationId || null,
      associatedSchoolId: input.associatedSchoolId || null,
      title: input.courseTitle,
      recipientNameSnapshot: input.recipientName,
      recipientMegaIdSnapshot: input.recipientUserId,
      issuerNameSnapshot: input.organizationName || "MEGA.EDU",
      associatedSchoolNameSnapshot: input.associatedSchoolName || null,
      instructorNameSnapshot: input.instructorName || null,
    },
  });
}
