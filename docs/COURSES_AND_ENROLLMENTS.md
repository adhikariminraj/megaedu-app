# Courses & Enrollments (MEGA Academy)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase.

## Model ✅

`Course` (belongs to an `Organization`, optionally an `EducationalApproach` and an `Instructor`) → `CourseModule` → `Lesson`, plus `CourseEnrollment` (either `teacherId` or `studentId`, never neither) and its optional 1:1 `Certificate`. Full field list in [DATABASE.md](DATABASE.md).

## Course creation ✅

An Organization Admin creates a course from their dashboard (`OrgDashboard.tsx` → `POST /api/organizations/[id]/courses`, gated by `requireOrgAdmin`): title, description, and an optional plain-text instructor name (creates an `Instructor` row inline, no MEGA ID required). New courses are free by default (`priceCents: 0`) and unpublished (`published: false`).

## Course publishing ✅ / ⚠️

From `/dashboard/courses/[courseId]/manage` (gated by `requireCourseOwner`), the admin adds `CourseModule`s and `Lesson`s, then toggles `published`. **Publishing requires at least one lesson** — the toggle is disabled otherwise. ⚠️ An unverified organization can still publish — no route checks `Organization.verified` before allowing this (confirmed via a fresh code search). See [KNOWN_GAPS.md](KNOWN_GAPS.md).

## Organizations vs. Schools in MEGA Academy ✅

Every course belongs to an `Organization`, never a `School` — schools have no course-authoring capability in the current system. `Certificate.associatedSchoolId` links a certificate to the recipient's school as *informational context*, not as course ownership.

## Free courses ✅

Enrollment for a free course (`priceCents: 0`) works end-to-end: `POST /api/courses/[courseId]/enroll` → idempotent (`alreadyEnrolled: true` on re-submission) → learn page → `POST /api/enrollments/[enrollmentId]/complete` → certificate issued atomically.

## Premium courses, school bundles, grade-specific bundles, personal purchase 🔭 (not implemented — see note below)

**None of these exist in the codebase.** A direct search for "premium" or "bundle" anywhere in the source returns zero matches. What actually exists:

- `Course.priceCents` — a plain integer field. If it's `> 0`, enrollment is **explicitly blocked** with the error "Paid course enrollment isn't available yet. This course is not free." No purchase flow of any kind runs.
- No concept of a "bundle," "tier," or "grade-specific" course package exists in the schema or any route.
- No prior design discussion in this project approved a bundle/premium model either — this isn't a regression, it's simply undesigned territory. See [PRODUCT_RULES.md](PRODUCT_RULES.md) for the explicit note on this.

If a school-wide or grade-specific bundle purchase model is wanted, it would need to be designed from scratch — there's no partial implementation to build on top of.

## Enrollment ✅

`POST /api/courses/[courseId]/enroll`:
- Requires login and a `Teacher` or `Student` profile (`403` otherwise — School Admins, Parents, Org Admins, Accountants can't enroll).
- Requires the course to be `published`.
- Blocks any priced course (see above).
- Idempotent.

This is the **only** enrollment access method that exists — there is no invite-only enrollment, no school-assigned bulk enrollment, and no "grade-gated" course visibility.

## Course completion & certificates ✅

`/courses/[slug]/learn` (login required) shows every module/lesson and a `CompleteButton` once content exists. `POST /api/enrollments/[enrollmentId]/complete`:
- Ownership-checked, idempotent (`alreadyCompleted: true` returns the existing certificate).
- In one transaction: `progress: 100` + `completedAt`, then `issueCourseCertificate()` — an enrollment can never end up "complete" with no certificate or vice versa.
- `CERTIFICATE_ISSUED` notification follows (best-effort).

The learn page shows a completion banner linking to `/verify/[verificationCode]`; the dashboards link to the designed preview instead (see [CERTIFICATES.md](CERTIFICATES.md)).

## What's designed but not wired 🔭

- **Paid enrollment / payment integration.** `Subscription`/`Payment` are modeled, no processor connected.
- **Progress tracking beyond 0/100.** `CourseEnrollment.progress` exists but nothing updates it incrementally.
- **Course reviews/ratings, richer search/filtering.** Not present.

## Explicitly out of scope for Phase 2

Per the Phase 2 design brief, this system was untouched by the Academic Sessions & Grades work — no changes were made here, and grade-certificate issuance (once built) would be a parallel path alongside `issueCourseCertificate()`, not a replacement.
