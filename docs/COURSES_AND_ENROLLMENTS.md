# Courses & Enrollments (MEGA Academy)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-10 (K1-K9 reconciliation, plus a MEGA Academy planning-scope reconciliation — Program/D3 and Certificate/D5 distinctions), against the current codebase.

## Model ✅

`Course` (belongs to an `Organization`, optionally an `EducationalApproach` and an `Instructor`) → `CourseModule` → `Lesson`, plus `CourseEnrollment` and its optional 1:1 `Certificate`. Full field list in [DATABASE.md](DATABASE.md).

**`CourseEnrollment` identity (Academy Participation kilometer, 2026-09-10):** `userId` (required, direct FK to `User`) is the enrollment's real identity anchor — any authenticated MEGA ID may enroll, independent of institutional role. `teacherId`/`studentId` remain on the model but are now **optional contextual enrichment only**: populated whenever the enrolling user happens to also hold that profile, purely so `TeacherDashboard`/`StudentDashboard`'s existing `teacher.courseEnrollments`/`student.courseEnrollments` reverse-relation queries keep working. They are never re-derived as the enrollment's identity and are both `null` for a Parent, Organization Admin/Accountant, or any other enrollee with neither profile. `@@unique([courseId, userId])` enforces one enrollment per user per course.

Why: the prior model required a `Teacher` or `Student` profile to enroll at all, which structurally excluded Parents, Organization Admins/Accountants, and independent MEGA ID holders from Academy participation — a real gap identified in the Master Ecosystem Map alignment audit. `Certificate`/`issueCourseCertificate()` already addressed recipients by `User.id` natively and needed no changes; only the enrollment identity and its two consuming routes did.

Migration: `userId` was added nullable, backfilled from each row's `teacher.userId ?? student.userId` (3/3 existing rows, 100% resolvable, verified by exact-match comparison), then promoted to required. The unique constraint was added after confirming zero duplicate `(courseId, userId)` pairs among the existing rows.

## Course creation ✅

An Organization Admin creates a course from their dashboard (`OrgDashboard.tsx` → `POST /api/organizations/[id]/courses`, gated by `requireOrgAdmin`): title, description, and an optional plain-text instructor name (creates an `Instructor` row inline, no MEGA ID required). New courses are free by default (`priceCents: 0`) and unpublished (`published: false`).

## Course publishing ✅

From `/dashboard/courses/[courseId]/manage` (gated by `requireCourseOwner`), the admin adds `CourseModule`s and `Lesson`s, then toggles `published`. **Publishing requires at least one lesson** — the toggle is disabled otherwise. `Organization.verified` is enforced on the `published: true` transition (`PATCH /api/courses/[courseId]`) — an unverified organization's course cannot be published, and `POST /api/courses/[courseId]/enroll` blocks enrollment as a belt-and-suspenders check in case verification is ever revoked after publish.

**Organization Academy Participation kilometer (2026-09-10):** publishing and enrollment now also require `Organization.academyParticipant === true` — a second, independent fact from `verified` (see [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md)). A verified organization that hasn't opted into Academy participation is blocked exactly like an unverified one; toggling participation off immediately blocks new publish/enroll attempts on that organization's courses, with no effect on existing courses, enrollments, or certificates (nothing is deleted or altered — the gate is checked fresh on every request, never cached).

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
- Requires the course to be `published` and its organization both `verified` and `academyParticipant` (see Course publishing, above).
- Blocks any priced course (see above).
- Idempotent, keyed on `(courseId, userId)`.
- If the enrolling user holds a `Teacher` or `Student` profile, `teacherId`/`studentId` are populated on the row as contextual enrichment (see Model section above) — this is never a requirement to enroll, only an enrichment when applicable.

This is the **only** enrollment access method that exists — there is no invite-only enrollment, no school-assigned bulk enrollment, and no "grade-gated" course visibility. There is also no dedicated dashboard surface for Parent/Organization-Admin/unaffiliated enrolled courses yet — completion and certificates work for them via the same API, but nothing outside `TeacherDashboard`/`StudentDashboard` currently lists "my enrolled courses" (see Deferred, below).

## Public Organization provider profile ✅ (Kilometer 1, 2026-09-10)

`/organizations/[slug]` — public, unauthenticated, mirroring `/schools/[slug]`'s pattern exactly: independently re-verifies `verified && isActive` at the detail-page level (never relying only on `/organizations`'s own list filter — a slug is guessable/shareable). Displays `name`, `description`, `website`, and two **independent** trust badges — "✓ Verified Organization" (always, since the page requires it to exist at all) and "✓ MEGA Academy Provider" (only when `academyParticipant` is also true) — deliberately never combined into one compound status, per the approved Organization ↔ Academy design.

**Academy participation states**: a participating organization (`academyParticipant: true`) shows its `published` courses, each linking to `/courses/[slug]`; a non-participating one shows "Not currently offering courses on MEGA Academy" instead — its existing courses are never unpublished, deleted, or otherwise mutated by this state, only omitted from this one listing. The organization's `Opportunities` are shown regardless of Academy participation, since that relationship is independent of Academy entirely.

`/organizations` now links each card to this profile page and shows the same "MEGA Academy Provider" badge for participating organizations, continuing to list every verified organization regardless of participation (per the approved "Organization existence ≠ Academy participation" decision) — never filtered by `academyParticipant`.

## Global Academy read-time visibility ✅

`/courses`, `/courses/[slug]`, and the homepage's course query all key off the identical condition: `published && organization.verified && organization.academyParticipant && organization.isActive`. A course from an organization that later loses any one of those three facts (unverified, stops participating, or deactivated) simply stops appearing at every one of these surfaces the moment the fact changes, and reappears the moment it's true again — the course row itself, its enrollments, and any issued certificates are never touched. `/courses/[slug]/learn` (an already-enrolled learner's own access) is deliberately **not** subject to this gate — historical access is preserved regardless of the organization's current state.

## Course → Provider reciprocal links ✅

The organization/provider name on `/courses`, `/courses/[slug]`, and the homepage's "Explore the Network" course cards is a real link to `/organizations/[organization.slug]` (not plain text), completing the reverse direction of the journey the Public Organization provider profile (above) established — a visitor can now move from a course to its provider and back. Where a card's own link (to the course) and the new provider link would otherwise nest inside one another, the card was restructured into a plain wrapper containing two independent links rather than one link wrapping the whole card — a technical necessity to avoid invalid nested `<a>` elements, not a visual redesign.

## Course completion & certificates ✅

`/courses/[slug]/learn` (login required) shows every module/lesson and a `CompleteButton` once content exists. `POST /api/enrollments/[enrollmentId]/complete`:
- Ownership-checked, idempotent (`alreadyCompleted: true` returns the existing certificate).
- In one transaction: `progress: 100` + `completedAt`, then `issueCourseCertificate()` — an enrollment can never end up "complete" with no certificate or vice versa.
- `CERTIFICATE_ISSUED` notification follows (best-effort).

The learn page shows a completion banner linking to `/verify/[verificationCode]`; the dashboards link to the designed preview instead (see [CERTIFICATES.md](CERTIFICATES.md)).

## MEGA Academy planning reconciliation — Program scope, Certificate scope, Labs pilot (2026-09-10) 🟡

**Documentation-only reconciliation.** No code, schema, API, or UI changed by this entry — it exists to record a scope decision before any future Academy learning-domain kilometer is authorized. The "D3"/"D5" labels below are as given directly by the person requesting this reconciliation; no separate Master Development Plan document exists in this repository to independently cross-check their exact wording against (confirmed by direct repository search) — they are recorded here as the operative decision for this project going forward, not as a citation of an external document this session has read.

### Academy Program vs. "D3 — Organization-owned Programs" — explicitly not the same scope

A future MEGA Academy learning-domain kilometer may introduce an **Academy Program**, defined as:

> "An Academy learning-domain construct used to organize a structured learning pathway or collection of courses within MEGA Academy."

This is separate and distinct from **D3 — Organization-owned Programs equivalent to the School `Program` model** (an institutional-presence content type, the same shape `School.programs`/`Organization` posts already use elsewhere). **Academy Program does not automatically implement D3.** Specifically, a future Academy Program construct:
- does **not** establish the broader D3 Organization Program capability;
- does **not** require or imply C2.2 (historical Organization-affiliation modeling — see [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md));
- does **not** require or imply C2.3 (multi-organization dashboard switching — same document);
- remains subject to D3's own, separate governance and approval, whenever that is taken up.

Any future kilometer proposing an Academy Program construct must state this distinction explicitly rather than silently broadening scope to cover D3.

### Existing certificate verification reuse vs. "D5 — richer certificate capabilities" — explicitly not the same scope

MEGA Academy's course-completion flow already reuses the existing, real, working certificate architecture described above (`issueCourseCertificate()`, `Certificate.recipientUserId` user-centric identity, the public `/verify/[code]` page) — this reuse is **not** new scope and is not D5. **D5 — richer certificate capabilities (QR-code generation, advanced/PDF certificate presentation, grade-completion certificate variants)** remains a distinct, future, separately-governed item. Any future Academy kilometer must clearly separate:
- **(A) existing capability being reused as-is** — course-completion certificate issuance and public verification, both already live and unchanged; and
- **(B) future D5 enhancements** — QR generation, richer/PDF presentation, grade-completion variants — none of which exist today and none of which are authorized by reusing (A).

A kilometer must not present (B) as if it were already part of the MVP simply because (A) exists and works.

### MEGA Academy Labs — pilot principle, not a special architecture

`MEGA Academy Labs` (the demo Organization used throughout this project's Academy-related testing) may continue to serve as the first real Academy provider/pilot once a learning-domain kilometer is built. It must use the exact same `Organization → academyParticipant → Course` architecture every other participating Organization uses — no organization-specific code path, no special-cased model, no bypass of `requireOrgAdmin`/`verified`/`academyParticipant`. The pilot is a validation strategy for the shared architecture, never a separate product model.

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
