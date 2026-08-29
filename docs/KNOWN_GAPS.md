# Known Gaps & Issues

> Last verified: 2026-08-29 (Phase 3B) — every item below was actively re-checked against the current codebase before being listed (grep/read, not assumption). If an item is ever fixed, move it out of this file rather than leaving it marked open.

## Data model gaps

### `Organization` has no logo field at all ⚠️
Unlike `School` (which has `logoUrl`, just unpopulated), `Organization` has no such column in the schema. The certificate system already handles this gracefully (name-only fallback), so it isn't breaking anything today, but it's a real structural gap if organization logos are ever wanted. See [DATABASE.md](DATABASE.md), [CERTIFICATES.md](CERTIFICATES.md).

### `School.isActive` / `Organization.isActive` are read but never written ⚠️
Both fields default to `true` and are used as a filter in two places (`schools/search`, Platform Admin dashboard counts), but **no route anywhere ever sets either to `false`**. There is no deactivation action in the app. Confirmed via a direct search: `isActive` appears in exactly three files, all reads.

## Enforcement gaps

### Organization verification isn't enforced on course publishing or enrollment ⚠️
`Organization.verified` exists and is set by a Platform Admin, and the Org Admin dashboard tells the admin their courses won't "go live" until verified — but nothing in `PATCH /api/courses/[courseId]` (the publish toggle) or `POST /api/courses/[courseId]/enroll` actually checks `verified`. Confirmed with a fresh search across both routes: zero references to `verified`. An unverified organization can publish and receive enrollments today. See [USER_ROLES.md](USER_ROLES.md), [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md).

## Database portability

### SQLite-specific transaction behavior in two bulk-write routes ⚠️
`POST /api/schools/[id]/grade-placements` and `POST /api/schools/[id]/teacher-assignments` catch a unique-constraint violation inside an open `prisma.$transaction` and continue the loop — this relies on SQLite tolerating a caught statement error without poisoning the rest of the transaction, which is **not** true on Postgres (the documented production target). Measured, not assumed: verified directly that SQLite continues correctly; reasoned (not yet tested against a real Postgres instance, since none exists in this project) that Postgres would abort the transaction after the first collision. Needs rework before any Postgres migration. Full detail: [PRODUCT_RULES.md](PRODUCT_RULES.md), [DEPLOYMENT.md](DEPLOYMENT.md).
**Not affected**: `grade-decisions` and the rollover carry-forward sweep — both validate eligibility *before* opening the transaction and never intentionally hit a duplicate mid-transaction, a genuinely different and Postgres-safe pattern.

## Testing

### No automated test suite exists ⚠️
No Jest/Vitest/Playwright/Cypress, no config, no `*.test.*` files anywhere in the repository — confirmed by checking `package.json` and searching the tree. See [TESTING.md](TESTING.md) for what verification practice is used instead (typecheck gate, live browser runs against seeded fixtures, throwaway `tsx` scripts).

## Commerce / payments

### No payment processor is integrated 🔭
`Subscription`/`Payment` are modeled but unconnected. Paid course enrollment (`priceCents > 0`) is explicitly blocked rather than attempted. No "premium," "bundle," or "grade-specific package" concept exists anywhere in the code — confirmed via a direct search returning zero matches. See [PRODUCT_RULES.md](PRODUCT_RULES.md), [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md).

## Certificates

### PDF export and QR code generation are not built 🔭
The certificate visual design is finished and approved as an in-browser preview; downloading a PDF and generating a scannable QR code were both explicitly deferred and never started. A space for the QR code is marked on the certificate layout but rendered empty. See [CERTIFICATES.md](CERTIFICATES.md).

### Grade-certificate issuance doesn't exist 🔭
`Certificate.gradeHistoryId` is a reserved, unlinked column. No `issueGradeCertificate()` function exists, even though `GradeHistory` (its intended data source) is now fully built. This was a deliberate Phase 2 scope exclusion, not an oversight.

## Phase 2 (Academic Sessions & Grades) — role visibility gaps

### Teachers, Students, and Parents have no dashboard visibility into Phase 2 data 🔭
All of Initial Setup, Promotion, and New Session rollover are School-Admin-only surfaces. A Teacher still can't see their own `TeacherGradeAssignment`s (grade-level, Phase 2) or the roster of a grade they're assigned to — though Phase 3A added read-only visibility into their `TeacherAcademicAssignment`s (subject-level), and Phase 3B added their `ClassTeacherAssignment`s plus attendance/teaching-progress/test-result visibility for the *student* side — narrower fixes, not this whole gap. A Student still can't see their raw `GradeHistory`/current grade/section directly (only the derived Phase 3B views — attendance, teaching progress, test results); a Parent can't see a linked child's structured grade, attendance, or any Phase 3B data at all (the Parent dashboard still shows only the legacy `gradeLevel` text) — explicitly out of scope for Phase 3B per the brief ("Do not build unrelated parent features unless the existing Parent architecture already makes this straightforward"). None of this was in Phase 2, 3A, or 3B's scope, but it's worth tracking as the natural next surface.

### `Skill` isn't scoped to a teacher's grade assignment 🔭
Any approved teacher at a school can add a `Skill` to any approved student at that school — there's no check against `TeacherGradeAssignment` to restrict this to students in a grade the teacher actually teaches. Pre-dates Phase 2 and wasn't addressed by it.

## Sections — deliberately deferred scope

### No section-level teacher assignment 🔭
Teachers are assigned at the grade level only (`TeacherGradeAssignment`); no `TeacherSectionAssignment` concept exists. Explicitly decided during design, not an oversight — see [PRODUCT_RULES.md](PRODUCT_RULES.md).

### No section-level analytics or reporting 🔭
No per-section counts, dashboards, or breakdowns exist anywhere in the app. Explicitly out of scope for the same reason as above.

## Phase 3A (Subjects & Teacher Academic Assignment)

### A `GradeSubject` offering must be reconfigured from scratch every session 🔭
Deliberate, not a bug (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) — a new session starts with zero subject offerings for every grade, nothing copied from the prior session, so past curricula stay reconstructable. No "copy from last session" convenience action exists, so a school whose curriculum rarely changes must still re-enter it every session. Worth considering as a future opt-in convenience feature that still preserves the underlying session-scoped rows.

## Phase 3B (School Academic Operations)

### A `TeachingUnit`/`TeachingPlan` set must be reconfigured from scratch every session 🔭
Same deliberate non-carry-forward pattern as `GradeSubject` above — a new session starts with zero units/plans, nothing copied from the prior session. No "copy from last session" convenience action exists.

### No teaching hierarchy (primary/assistant/substitute teacher) for either academic or Class/Section Teacher assignments 🔭
Explicitly out of scope, confirmed twice — once for `TeacherAcademicAssignment` in Phase 3A, again for `ClassTeacherAssignment` in Phase 3B ("Do not introduce teacher hierarchy... yet").

### No retest concept for Unit/Chapter Tests 🔭
`UnitTestResult` supports `PENDING`/`EVALUATED`/`ABSENT` only — explicitly deferred, not built.

### Homework, examinations beyond Unit/Chapter Tests, report cards, and analytics are not started 🔭
All explicitly out of scope for Phase 3B, to be scoped and approved separately in a later Phase 3 sub-phase. See [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md).

## Authentication

### Several standard auth features are absent 🔭
No OAuth/SSO, no email verification at registration, no password reset flow, no login/registration rate limiting, no session revocation ("log out everywhere"), no account deactivation or deletion route for any model. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).

### `PLATFORM_ADMIN` can only be granted via the seed script or direct database access 🔭
No in-app route or UI exists to promote a user to Platform Admin, or to revoke it.
