import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase 1 certificate migration — Pass 1 backfill.
 *
 * For every existing Certificate row, creates the corresponding
 * CertificateV2 row using the confirmed, deterministic mapping:
 *   - If the old row's teacherId is set  → recipient = that Teacher's userId
 *   - If the old row's teacherId is null → recipient = the enrollment's
 *     Student's userId (this is the case the old schema had no direct
 *     link for at all)
 *
 * Every existing certificate came from a MEGA Academy course (never a
 * grade — GradeHistory doesn't exist yet), so issuerType is always
 * "ORGANIZATION", sourced from the enrollment's course's organization.
 *
 * This script is safe to run more than once — it skips any old
 * certificate that already has a matching CertificateV2 (matched by
 * enrollmentId).
 */
async function main() {
  const oldCertificates = await prisma.certificate.findMany({
    include: {
      enrollment: {
        include: {
          teacher: { include: { user: true } },
          student: { include: { user: true } },
          course: { include: { organization: true } },
        },
      },
      teacher: { include: { user: true } },
    },
  });

  console.log(`Found ${oldCertificates.length} existing certificate(s) to migrate.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const old of oldCertificates) {
    const existing = await prisma.certificateV2.findUnique({
      where: { enrollmentId: old.enrollmentId },
    });
    if (existing) {
      console.log(`SKIP  ${old.id} — already migrated (CertificateV2 ${existing.id})`);
      skipped++;
      continue;
    }

    // The confirmed mapping: teacherId set → that teacher is the
    // recipient. teacherId null → the enrollment's student is the
    // recipient (the case the old schema never linked directly).
    let recipientUser;
    if (old.teacherId && old.teacher) {
      recipientUser = old.teacher.user;
    } else if (old.enrollment.student) {
      recipientUser = old.enrollment.student.user;
    } else if (old.enrollment.teacher) {
      // Defensive fallback: teacherId was null on the certificate but the
      // enrollment itself is a teacher's — use that.
      recipientUser = old.enrollment.teacher.user;
    } else {
      console.log(`ERROR ${old.id} — could not resolve a recipient at all; skipping. Please review manually.`);
      skipped++;
      continue;
    }

    const org = old.enrollment.course.organization;

    const created = await prisma.certificateV2.create({
      data: {
        verificationCode: old.verificationCode, // preserve the existing code so old links keep working
        recipientUserId: recipientUser.id,
        enrollmentId: old.enrollmentId,
        issuerType: "ORGANIZATION",
        issuerOrganizationId: org?.id,
        title: old.enrollment.course.title,
        recipientNameSnapshot: recipientUser.name,
        recipientMegaIdSnapshot: recipientUser.id,
        issuerNameSnapshot: org?.name || "Unknown Organization",
        issuedAt: old.issuedAt,
      },
    });

    console.log(
      `OK    ${old.id} → CertificateV2 ${created.id}  (recipient: ${recipientUser.name}, via ${old.teacherId ? "teacherId" : "enrollment.student"})`
    );
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}. Skipped/already done: ${skipped}. Total: ${oldCertificates.length}.`);
  console.log(`\nNext step: review the output above, then confirm before Pass 2 (which removes the old Certificate model).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
