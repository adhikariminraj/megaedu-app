# Known Gaps & Issues

> Last verified: 2026-08-28 — every item below was actively re-checked against the current codebase before being listed (grep/read, not assumption). If an item is ever fixed, move it out of this file rather than leaving it marked open.

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
All of Initial Setup, Promotion, and New Session rollover are School-Admin-only surfaces. A Teacher can't see their own `TeacherGradeAssignment`s or the roster of a grade they're assigned to; a Student can't see their own `GradeHistory`/current grade; a Parent can't see a linked child's structured grade at all (the Parent dashboard still shows only the legacy `gradeLevel` text). None of this was in Phase 2's scope, but it's worth tracking as the natural next surface.

### `Skill` isn't scoped to a teacher's grade assignment 🔭
Any approved teacher at a school can add a `Skill` to any approved student at that school — there's no check against `TeacherGradeAssignment` to restrict this to students in a grade the teacher actually teaches. Pre-dates Phase 2 and wasn't addressed by it.

## Authentication

### Several standard auth features are absent 🔭
No OAuth/SSO, no email verification at registration, no password reset flow, no login/registration rate limiting, no session revocation ("log out everywhere"), no account deactivation or deletion route for any model. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).

### `PLATFORM_ADMIN` can only be granted via the seed script or direct database access 🔭
No in-app route or UI exists to promote a user to Platform Admin, or to revoke it.
