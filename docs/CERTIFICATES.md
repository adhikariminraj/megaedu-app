# Certificates

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase.

## Model ✅

`Certificate` (see [DATABASE.md](DATABASE.md) for the full field list) deliberately keeps **recipient, instructor, and issuer as separate concepts** — never conflated:

- `recipientUserId` + `recipientNameSnapshot`/`recipientMegaIdSnapshot` — who earned it.
- `instructorId?` + `instructorNameSnapshot?` — who taught it, if recorded. `Instructor` doesn't require a MEGA ID.
- `issuerType` (`MEGA_EDU | ORGANIZATION | SCHOOL | JOINT`) + `issuerOrganizationId?`/`issuerSchoolId?` + `issuerNameSnapshot` — who issued it.
- `associatedSchoolId?` + `associatedSchoolNameSnapshot?` — a separate "affiliated school" context (e.g. the recipient's own school), distinct from the issuer, shown as its own detail line rather than folded into the issuer.

All `*Snapshot` fields are frozen at issuance time and never re-derived from live data — see [PRODUCT_RULES.md](PRODUCT_RULES.md). The one deliberate exception is the partner logo, looked up live via `issuerSchool.logoUrl`/`associatedSchool.logoUrl` (no snapshot field exists for it).

`gradeHistoryId?` is reserved for grade certificates but has **no live Prisma relation declared** — a bare, unlinked `String?` column. Even though `GradeHistory` now fully exists and is heavily used (Phase 2), this field remains untouched — grade-certificate issuance was deliberately kept out of Phase 2's scope.

## Issuance — course certificates ✅

**`issueCourseCertificate()`** (`src/lib/certificates.ts`) is the only code path that creates a `Certificate` for a course. Called from `POST /api/enrollments/[enrollmentId]/complete`, inside the same transaction that marks the `CourseEnrollment` complete. Sets `issuerType: "ORGANIZATION"` unconditionally (the only issuer type reachable today). A `CERTIFICATE_ISSUED` notification follows (best-effort, outside the transaction).

## Grade certificates 🟡 (designed, not implemented)

**`issueGradeCertificate()`** doesn't exist. The `certificates.ts` doc comment explicitly earmarks this as future work, parallel to the course path, once `GradeHistory` exists — which it now does, but the issuance function itself was never built, by explicit scope decision (Phase 2's brief excluded certificates entirely).

## Display: `CertificateDocument` ✅

`src/components/certificate/CertificateDocument.tsx` — a true-to-size A4 landscape (1123×794px on-screen, `@page { size: 297mm 210mm }` for print) layout, driven by a `CertificateViewModel` from `buildCertificateViewModel()` (`src/lib/certificateView.ts`), reading only snapshot fields plus the live logo lookup.

**Layout, top to bottom**: MEGA.EDU wordmark (left, or centered alone with no partner) / partner institution logo-or-name (right) → eyebrow ("Certificate of Completion" or "Certificate of Achievement" depending on `isGradeCertificate`) → "This certificate is proudly presented to" → recipient name (verified to wrap gracefully up to ~100 characters without overflow) → `MEGA ID: {id}` → "for successfully completing" → course/grade title → detail row (Completion Date, Instructor if present, Affiliated School if present and distinct from the partner) → signature lines → Certificate ID + "Verify this certificate through MEGA.EDU" + a marked-but-empty QR code space.

**Course vs. grade wording** 🟡 — the template branches on `!!certificate.gradeHistoryId`, but since no grade certificate has ever been issued (no issuance function exists), this branch is exercised only by design review, never by real data.

**Partner logo resolution** ✅ — for `issuerType SCHOOL`/`JOINT`, the partner is `issuerSchool` (real `logoUrl` if present, else name-only); for `ORGANIZATION`/`JOINT` fallback, always name-only, since `Organization` has no `logoUrl` field in the schema at all (⚠️ see [KNOWN_GAPS.md](KNOWN_GAPS.md)). For `MEGA_EDU`, no partner — the hero re-centers around the MEGA.EDU wordmark alone.

## Where it's shown ✅

- **`/dashboard/certificates/[id]/preview`** — the designed, owner-facing view. Access-gated to the certificate's recipient or a Platform Admin, verified live with three different sessions. Wrapped in `CertificateScaler.tsx`, which scales the fixed-size document to fit the viewport.
- **`/verify/[code]`** — public, no-login, plain-text verification page. Deliberately separate and unstyled; see [PRODUCT_RULES.md](PRODUCT_RULES.md).
- Linked from `TeacherDashboard.tsx`/`StudentDashboard.tsx`'s course list ("View certificate →" → the preview page, via `certificate.id`) and from the course "learn" page's completion banner (→ `/verify/[code]`).

## Verification ✅ / 🔭

The Certificate ID (`verificationCode`) is shown prominently on both surfaces. A space for a QR code is marked but empty on the certificate document — no QR generation library has been added.

## PDF generation 🔭

Not built. The certificate design was explicitly staged to be approved as an in-browser preview first, with PDF export deferred to a later pass.

## School/organization logos on certificates ✅ (mechanism) / ⚠️ (data)

The mechanism is fully built and correct (see Partner logo resolution above), but **no school or organization in the current database actually has a logo** — every `School.logoUrl` is `null`, and `Organization` has no such field at all. Every certificate rendered today shows the name-only fallback, which was explicitly designed for and verified to look correct, not a broken/unfinished state.
