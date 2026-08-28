import type { Certificate, School } from "@prisma/client";

/**
 * The certificate shape this module needs, with just enough of the live
 * issuerSchool/associatedSchool relations included to source a logo image.
 * Everything else (names, titles, dates) comes from the certificate's own
 * *Snapshot fields — never live-looked-up — so a later school/org rename
 * can never alter an already-issued certificate. Logos are the deliberate
 * exception: there's no logoUrlSnapshot field, so a school/org's current
 * logo is what renders, the same way a profile photo update usually
 * applies retroactively.
 */
export type CertificateWithLogoSources = Certificate & {
  issuerSchool: Pick<School, "logoUrl"> | null;
  associatedSchool: Pick<School, "logoUrl"> | null;
};

export type CertificatePartner = {
  name: string;
  logoUrl: string | null;
};

export type CertificateViewModel = {
  verificationCode: string;
  title: string;
  recipientName: string;
  recipientMegaId: string;
  issuerType: string;
  issuerName: string;
  associatedSchoolName: string | null;
  instructorName: string | null;
  issuedAt: Date;
  /** True once GradeHistory-backed certificates exist (Phase 2). Always false today. */
  isGradeCertificate: boolean;
  /**
   * The school/organization credited alongside MEGA.EDU on the right side
   * of the hero. Null when the certificate is a pure MEGA.EDU issuance
   * with no partner institution.
   */
  partner: CertificatePartner | null;
};

export function buildCertificateViewModel(
  cert: CertificateWithLogoSources
): CertificateViewModel {
  let partner: CertificatePartner | null = null;

  if (cert.issuerType === "SCHOOL" || cert.issuerType === "JOINT") {
    if (cert.issuerSchoolId) {
      partner = { name: cert.issuerNameSnapshot, logoUrl: cert.issuerSchool?.logoUrl ?? null };
    }
  }
  if (!partner && (cert.issuerType === "ORGANIZATION" || cert.issuerType === "JOINT")) {
    if (cert.issuerOrganizationId) {
      // Organization has no logo field in the schema today, so this is
      // always name-only — that's the graceful "no logo" fallback, not a
      // bug to patch around.
      partner = { name: cert.issuerNameSnapshot, logoUrl: null };
    }
  }

  return {
    verificationCode: cert.verificationCode,
    title: cert.title,
    recipientName: cert.recipientNameSnapshot,
    recipientMegaId: cert.recipientMegaIdSnapshot,
    issuerType: cert.issuerType,
    issuerName: cert.issuerNameSnapshot,
    associatedSchoolName: cert.associatedSchoolNameSnapshot,
    instructorName: cert.instructorNameSnapshot,
    issuedAt: cert.issuedAt,
    isGradeCertificate: !!cert.gradeHistoryId,
    partner,
  };
}
