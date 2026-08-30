# Known Gaps & Issues

> Last verified: 2026-08-30 (Phase 3D-1 — Assessment Framework Foundation) — every item below was actively re-checked against the current codebase before being listed (grep/read, not assumption). If an item is ever fixed, move it out of this file rather than leaving it marked open.

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

### Teachers and Students have no dashboard visibility into Phase 2 grade-placement data 🔭
All of Initial Setup, Promotion, and New Session rollover are School-Admin-only surfaces. A Teacher still can't see their own `TeacherGradeAssignment`s (grade-level, Phase 2) or the roster of a grade they're assigned to — though Phase 3A added read-only visibility into their `TeacherAcademicAssignment`s (subject-level), and Phase 3B added their `ClassTeacherAssignment`s plus attendance/teaching-progress/test-result visibility for the *student* side. A Student still can't see their raw `GradeHistory`/current grade/section directly (only the derived Phase 3B views — attendance, teaching progress, test results). None of this was in Phase 2, 3A, or 3B's scope, but it's worth tracking as the natural next surface.

### Parent visibility into structured `GradeHistory` (current grade/section) is still missing 🔭
The Parent dashboard shows a linked child's Phase 3B academic summary (attendance, teaching progress, test results — added as a standalone fix; see [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md)), but still has no view into the child's structured `GradeHistory` (current grade, section, promotion history) — only the legacy `gradeLevel` free-text field. Not part of Phase 3B's scope; the same gap already existed for the Student's own dashboard before Phase 3B closed it there.

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

### Homework, formal examinations beyond Unit/Chapter Tests, report cards, and analytics are not started 🔭
Explicitly out of scope for Phase 3B. **Partially closed by Phase 3C-1**: Teacher Qualitative Evaluation (General and Subject) and Parent-Teacher Meetings are now built — see [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md). Still genuinely missing: homework/assignments, formal term-wide examinations (beyond the existing per-unit Unit/Chapter Tests), report cards, and continuous/aggregate progress rollups — all reserved for a later Phase 3C sub-phase, to be scoped and approved separately.

## Phase 3C (Teacher Qualitative Evaluation & Parent-Teacher Meetings)

### `ParentTeacherMeeting.outcomeNotes` is not audited 🔭
Only `StudentEvaluation.remarks` has the audit-on-share requirement (explicitly specified for this phase); a meeting's outcome notes remain freely editable, current-state data — consistent with `TeacherAcademicAssignment`'s own non-audited precedent, not an oversight.

### No un-share path for a `StudentEvaluation` 🔭
`visibleToParent`/`visibleToStudent` only ever flip `false → true`. Matches the "permanent once released" precedent already established for `Certificate` issuance; revisit only if a genuine correction-after-sharing need arises.

### No parent-initiated Parent-Teacher Meeting requests 🔭
Explicitly deferred for this phase — "Parents are read-only recipients for now. Parent meeting requests can be considered later." See [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Phase 3D-1 (Assessment Framework Foundation)

### A framework's structure can be edited even after it's assigned, with no protection against invalidating future results 🔭
`AssessmentFramework`/`AssessmentPeriod`/`AssessmentComponent` are freely editable current-state config in this phase — deliberate, since no marks exist yet (Phase 3D-2 hasn't been built) for an edit to actually invalidate. Must be revisited once 3D-2 introduces real per-student results: editing a framework already in use (e.g. changing a component's `maxMarks` after marks have been entered against it) would silently corrupt previously-computed aggregates. Recorded here so the gap is addressed deliberately in 3D-2's design, not discovered as a live bug afterward.

### No `GET` list API routes exist for any Phase 3D-1 model 🔭
Every read happens through `/dashboard/assessment-frameworks`'s own direct Prisma queries — the same convention used by every other Phase 3A/3B admin config page. Not a gap in the current feature (nothing else needs to read this data over HTTP yet), but worth noting if a future integration (e.g. a marks-entry page needing to look up "what framework applies here") needs one.

## Authentication

### Several standard auth features are absent 🔭
No OAuth/SSO, no email verification at registration, no password reset flow, no login/registration rate limiting, no session revocation ("log out everywhere"), no account deactivation or deletion route for any model. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md). Add Student/Add Teacher (School Admin direct account creation) route around the missing reset flow specifically by having the admin set and relay a temporary password themselves at creation time — a workaround forced by this gap, not a fix for it; a real reset flow is still absent for every account regardless of how it was created.

### `PLATFORM_ADMIN` can only be granted via the seed script or direct database access 🔭
No in-app route or UI exists to promote a user to Platform Admin, or to revoke it.
