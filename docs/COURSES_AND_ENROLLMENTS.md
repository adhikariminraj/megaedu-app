# Courses & Enrollments (MEGA Academy)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-10, against the current codebase.

## Model ✅

`Course` (belongs to an `Organization`, optionally an `EducationalApproach` and an `Instructor`) → `CourseModule` → `Lesson`, plus `CourseEnrollment` and its optional 1:1 `Certificate`. Full field list in [DATABASE.md](DATABASE.md).

**`CourseEnrollment` identity (Academy Participation kilometer, 2026-09-10):** `userId` (required, direct FK to `User`) is the enrollment's real identity anchor — any authenticated MEGA ID may enroll, independent of institutional role. `teacherId`/`studentId` remain on the model but are now **optional contextual enrichment only**: populated whenever the enrolling user happens to also hold that profile, purely so `TeacherDashboard`/`StudentDashboard`'s existing `teacher.courseEnrollments`/`student.courseEnrollments` reverse-relation queries keep working. They are never re-derived as the enrollment's identity and are both `null` for a Parent, Organization Admin/Accountant, or any other enrollee with neither profile. `@@unique([courseId, userId])` enforces one enrollment per user per course.

Why: the prior model required a `Teacher` or `Student` profile to enroll at all, which structurally excluded Parents, Organization Admins/Accountants, and independent MEGA ID holders from Academy participation — a real gap identified in the Master Ecosystem Map alignment audit. `Certificate`/`issueCourseCertificate()` already addressed recipients by `User.id` natively and needed no changes; only the enrollment identity and its two consuming routes did.

Migration: `userId` was added nullable, backfilled from each row's `teacher.userId ?? student.userId` (3/3 existing rows, 100% resolvable, verified by exact-match comparison), then promoted to required. The unique constraint was added after confirming zero duplicate `(courseId, userId)` pairs among the existing rows.

## Course creation ✅

An Organization Admin creates a course from their dashboard (`OrgDashboard.tsx` → `POST /api/organizations/[id]/courses`, gated by `requireOrgAdmin`): title, description, and an optional plain-text instructor name (creates an `Instructor` row inline, no MEGA ID required). New courses are free by default (`priceCents: 0`) and unpublished (`published: false`).

## Course publishing ✅

From `/dashboard/courses/[courseId]/manage` (gated by `requireCourseOwner`), the admin adds `CourseModule`s and `Lesson`s, then toggles `published`. **Publishing requires at least one lesson** — the toggle is disabled otherwise. `Organization.verified` is enforced on the `published: true` transition (`PATCH /api/courses/[courseId]`) — an unverified organization's course cannot be published, and `POST /api/courses/[courseId]/enroll` blocks enrollment as a belt-and-suspenders check in case verification is ever revoked after publish.

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
- Requires login (`401` otherwise). **No institutional role is required** — any authenticated MEGA ID may enroll (Teacher, Student, Parent, Organization Admin, Organization Accountant, School Admin, Platform Admin, or a user with no profile at all). Authorization is simply "Authenticated User → eligible Academy course → enrollment."
- Requires the course to be `published` and its organization `verified`.
- Blocks any priced course (see above).
- Idempotent, keyed on `(courseId, userId)`.
- If the enrolling user holds a `Teacher` or `Student` profile, `teacherId`/`studentId` are populated on the row as contextual enrichment (see Model section above) — this is never a requirement to enroll, only an enrichment when applicable.

This is the **only** enrollment access method that exists — there is no invite-only enrollment, no school-assigned bulk enrollment, and no "grade-gated" course visibility. There is also no dedicated dashboard surface for Parent/Organization-Admin/unaffiliated enrolled courses yet — completion and certificates work for them via the same API, but nothing outside `TeacherDashboard`/`StudentDashboard` currently lists "my enrolled courses" (see Deferred, below).

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

## Deferred from the Academy Participation kilometer (2026-09-10) 🔭

Explicitly out of scope for that change, left for future work:
- **Instructor ↔ Teacher unification.** `Instructor` (plain-text, course-authoring) and `Teacher` (institutional, MEGA ID-backed) remain two separate concepts; not touched.
- **A dedicated enrolled-courses dashboard surface for Parents/Organization Admins/Accountants/unaffiliated learners.** They can enroll and complete courses via the API today, but no UI lists "my enrolled courses" for them the way `TeacherDashboard`/`StudentDashboard` do.
- **Organization institutional-context maturity** (historical affiliation model, `verifyOrgAccess()` equivalent) — flagged in the Master Ecosystem Map audit, not addressed here.
- **Audit-trail generalization** for enrollment/completion events beyond the existing `CERTIFICATE_ISSUED` notification.
- **A unified Person/Learner identity layer** spanning all roles — considered and explicitly rejected as larger than this problem (Option C in the design session); `User.id` already serves as that anchor for enrollment purposes.
- Payments, Resources, Events, Marketplace, and other Master Ecosystem Map roadmap domains — untouched.
