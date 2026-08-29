# Changelog

All notable changes to MEGA.EDU are recorded here, in [Keep a Changelog](https://keepachangelog.com/) style (`Added` / `Changed` / `Fixed`), newest first.

**A note on how this file was built**: the git history for this project is a single squashed `Initial commit` — there is no granular commit-by-commit history to generate this changelog from mechanically. What follows is a hand-written reconstruction of the real, verified milestones, grouped by feature area. Where a date is given below, it's inferred from the development session's own context (not a git commit timestamp) and should be read as approximate, not authoritative. **Going forward, add a dated entry here for every notable change** — that's the only way this file stays trustworthy once real commit history exists to lean on instead.

## Unreleased

### Added — Phase 3B: School Academic Operations (2026-08-29)
The second sub-phase of "Phase 3 — School Academic System," built additively on top of Phase 3A, with the same discipline — a schema/authorization checkpoint before any feature work, then each of the four sub-areas built, live-verified, and cleaned up in turn:

1. **Authorization correction, made before Phase 3B depended on it** — re-examined `requireTeacherAssignment()`'s section-matching logic (built in Phase 3A, never called by any route until now) and found it collapsed `sectionId: null` (grade-wide required) and *omitted* (no restriction) into the same code path, since both are falsy in JavaScript. Fixed with a shared `sectionScopeWhere()` three-way helper, used by both `requireTeacherAssignment()` and the new `requireClassTeacher()`. Verified independently (six scenarios against real assignment data) before any Teaching Unit/Test route was built on it.
2. **`ClassTeacherAssignment`** (`src/lib/authorize.ts`'s `requireClassTeacher()`, `POST/DELETE /api/schools/[id]/class-teacher-assignments...`) — Grade Class Teacher or Section Teacher, session-scoped, grade-wide and section-specific allowed to coexist (unlike `TeacherAcademicAssignment`). A live duplicate-creation test caught a real bug — the same `NULL ≠ NULL` unique-index gap already documented elsewhere in this schema let a second grade-wide assignment through — fixed with an explicit app-level pre-check, re-verified in both a single-request and an in-batch scenario.
3. **`Attendance` + `AttendanceAudit`** (`src/lib/attendance.ts`'s `correctAttendance()`, `POST/PATCH /api/schools/[id]/attendance...`) — one status per student per calendar day, never subject-based; corrections audited including remarks, not just status. Dates always derived from an explicit client-sent `"YYYY-MM-DD"` string, never the server's own clock. Permission boundaries verified through a real logged-in Section Teacher account: their own section succeeded, a different section and the whole grade unscoped both correctly returned `403`.
4. **`TeachingPlan` + `TeachingUnit`** (`POST .../teaching-plan`, `POST .../units`, `PATCH /api/schools/[id]/units/[unitId]`) — a planned-total target kept as its own model, independent of how many units actually exist; a display-terminology preference ("Unit"/"Chapter") as a plain string field, no second model; unit status (`NOT_STARTED`/`IN_PROGRESS`/`COMPLETED`) managing `startedAt`/`completedAt` automatically, verified through the full lifecycle including reverting a completed unit.
5. **`UnitTest` + `UnitTestResult`** (`POST /api/schools/[id]/units/[unitId]/tests`, `PATCH .../tests/[unitTestId]/results`) — creatable only once a unit is `IN_PROGRESS` or `COMPLETED` (verified: rejected while `NOT_STARTED`); a stable per-student roster (`PENDING`/`EVALUATED`/`ABSENT`) pre-created from `GradeHistory` at test-creation time, not inferred later.
6. **Read-side UI** — School Admin gained `/dashboard/attendance` and an extended `/dashboard/academics` (Class/Section Teacher panel, plus a new `/dashboard/academics/[gradeSubjectId]` page for Teaching Plans/Units/Tests, section-tabbed); Teacher dashboard gained linked sections for their Class/Section Teacher responsibilities and academic assignments; Student dashboard gained three new read-only sections (Teaching Progress, Test Results, Recent Attendance). Every write route enforces its own permission scope server-side — verified by exercising a genuine unauthorized attempt through the real UI/API, not just checking that a button was hidden.

**Verified live end-to-end**, as School Admin, Teacher, and Student, through the actual deployed UI: assigning a Grade Class Teacher and a Section Teacher to the same grade; setting a Teaching Plan with a custom "Chapter" label and watching it propagate through every heading and button in the UI; creating a chapter, moving it through its full status lifecycle, creating a test, evaluating one student and marking another absent; marking a class's attendance, then correcting one student's status and remarks and seeing the correction (not the original) reflected on that student's own dashboard. All throwaway test data (subjects, sections, students, teachers, units, tests, attendance records) and every temporary script were cleaned up afterward; the school's real pre-existing `GradeHistory` row and `TeacherGradeAssignment` rows were confirmed unaffected throughout, and typecheck passed clean (excluding the pre-existing, unrelated `prisma/backfill-certificates.ts` issue) at every checkpoint.

**Deliberately out of scope**, per the explicit Phase 3B brief: homework/assignments, parent-facing academic features, examinations beyond Unit/Chapter Tests, report cards, analytics, AI features, fees/accounting, messaging, and timetable/scheduling — all reserved for later phases.

New `docs/ACADEMIC_OPERATIONS.md` plus updates to `DATABASE.md`, `API.md`, `PRODUCT_RULES.md`, `AUTHENTICATION_AND_AUTHORIZATION.md`, `USER_ROLES.md`, `ARCHITECTURE.md`, `PROJECT_OVERVIEW.md`, and `KNOWN_GAPS.md` reflecting Phase 3B as implemented.

### Added — Phase 3A: Subjects & Teacher Academic Assignment (2026-08-29)
The first sub-phase of "Phase 3 — School Academic System," built additively on top of Phase 2 and the Section system, with the same live-verification discipline:

1. **Schema** — three new models (`Subject`, `GradeSubject`, `TeacherAcademicAssignment`), additive; only new relation-array fields added to `School`, `Teacher`, `AcademicSession`, `SchoolGrade`, `Section` — no existing column changed.
2. **Subject Catalog** (`POST/PATCH /api/schools/[id]/subjects...`) — school-wide, reusable catalog; deactivate only, no hard delete.
3. **Grade Subject Offering** (`POST/DELETE /api/schools/[id]/grades/[schoolGradeId]/subjects...`) — deliberately session-scoped, never carried forward, so past curricula stay reconstructable; a real delete route (unlike Subject/Section) since nothing permanent references it.
4. **Teacher Academic Assignment** (`POST/DELETE /api/schools/[id]/teacher-academic-assignments...`) — Teacher → Session → Grade → optional Section → Subject, with a server-side rule preventing the same teacher from holding both a grade-wide and section-specific assignment for one subject/grade/session at once, while allowing multiple different teachers to freely overlap (no teaching hierarchy).
5. **`requireTeacherAssignment()`** (`src/lib/authorize.ts`) — a new permission primitive, built ahead of its first caller as the explicit foundation for Phase 3B's attendance/homework/teaching-progress work.
6. **Read-side UI** — a new School Admin page (`/dashboard/academics`) managing the full structure; a new read-only "Your Academic Assignments" section on the Teacher dashboard.

**Verified live**, with evidence: subject bulk-create/dedup/rename-collision/deactivate; grade-offering idempotency and the deactivated-subject rejection; the grade-wide/section-specific overlap rule tested in both orderings plus confirming different sections and different teachers are correctly unaffected; the subject-not-offered-this-session rejection; the `GradeSubject` delete route's `409`-then-succeed behavior; `requireTeacherAssignment()`'s exact query logic verified directly against real assignment data (six scenarios, since no route calls it yet); the full UI exercised end-to-end for both School Admin and Teacher. All throwaway test data (subjects, sections, a second test teacher, offerings, assignments) and temporary scripts were fully cleaned up afterward; the school's one real pre-existing `GradeHistory` row and its 10 real `TeacherGradeAssignment` rows were confirmed unaffected, before and after.

**Deliberately out of scope**, per the explicit Phase 3A brief: student attendance, homework/assignments, teaching progress, units/lessons, student/parent academic dashboard features, examinations/results, analytics/reporting, and any teaching hierarchy (primary/assistant/substitute teacher) — all reserved for Phase 3B and later, to be designed separately.

### Added — Section system (2026-08-29)
An optional subdivision layer under `SchoolGrade` (e.g. Class 6 → A, B, C), built additively on top of Phase 2's existing schema and audit architecture, with every step independently verified against the real database and live UI — the same discipline used for the original Phase 2 build:

1. **Schema** — new `Section` model (`schoolGradeId, name, isActive`, `@@unique([schoolGradeId, name])`, cascades from `SchoolGrade`, no delete route); `GradeHistory.sectionId` (nullable FK); `GradeHistoryAudit.previousSectionId`/`newSectionId`. Purely additive — every existing `GradeHistory` row got `sectionId: null` automatically, no data migration needed.
2. **`reassignSection()`** (`src/lib/gradeHistory.ts`) — the sole audited write-path for changing section on an *existing* `GradeHistory` row, mirroring `recordGradeDecision()`'s shape exactly.
3. **New routes**: bulk section creation (`.../grades/[schoolGradeId]/sections`), rename/deactivate (`.../sections/[sectionId]`, `409` on a name collision), bulk audited assignment (`.../section-assignments`, `400` if the target section is deactivated or belongs to a different grade). `grade-placements` gained an optional `sectionId` at creation time (not audited, same reasoning as the initial `ENROLLED` status).
4. **Initial School Setup** — new "Create Sections" step (comma-separated bulk add, optional); the students step gained a section-assignment panel for already-placed students.
5. **Promotion Roster** — shows each student's current section; gained its own "Assign Section" panel, fully separate from the Promote/Repeat/Transfer/Leave action (different endpoint, only the checkbox selection is shared).

**Verified live**, with evidence: bulk creation/dedup, rename-collision `409`, deactivate/reactivate toggle both directions, server-side `isActive` enforcement via a raw API call bypassing the UI entirely (`400 "This section is deactivated."`), an active-vs-inactive `grade-placements` creation test (accepted section → 0 audit rows; inactive section → silently skipped, 0 rows created), and — the key requirement — a live promotion (assign Section A → promote to the next grade) proving the current row's section survives a decision completely untouched while the audit trail preserves the full chronology (`null→A`, then `A→A` alongside `ENROLLED→COMPLETED`). Rollover's non-inheritance of section was confirmed by reading `carryForwardEligibleStudents()`'s `create()` call directly — `sectionId` is structurally never one of the fields it writes. All throwaway test data (students, sections, grade-history/audit rows) was cleaned up afterward; the school's one real pre-existing `GradeHistory` row was confirmed untouched, before and after, by row count.

**Deliberately out of scope**, per explicit approval: section-level teacher assignment, section-level analytics/reporting, and any hard-delete path for sections (soft-deactivate only). Promotion/rollover eligibility remains entirely grade-based — sections never affect it.

### Added — Documentation regeneration (2026-08-28, approximate)
- Full `/docs` refresh establishing an accurate baseline for Phase 1 + Phase 2 as they actually exist in code — not a patch, a verified rewrite of every file against a fresh reading of the codebase.
- `ACADEMIC_SESSIONS.md` and `GRADES_AND_PROMOTION.md` fully rewritten — both previously described Initial Setup/Promotion/New Session rollover as not-yet-built; all three are now complete, so both docs needed a real rewrite, not a status-tag edit.
- `DATABASE.md` fully rewritten with a consistent per-model structure (Purpose / Key fields / Relationships / Constraints / Delete behavior / Currently used), and Phase 2 models' status corrected from "schema-only" to actively used.
- `PRODUCT_RULES.md` updated: several rules that were tagged "designed, not yet implemented" are now marked implemented with their verification evidence; new rules added for the carry-forward sweep's idempotency and the two pending-resolution paths; an explicit note added distinguishing "free course enrollment" (real) from "premium courses / bundles" (never implemented, never previously approved as a rule — a direct codebase search confirms this).
- Four new files: `API.md` (full inventory of all current API routes), `DEPLOYMENT.md` (local dev setup and what's known/unknown about production), `KNOWN_GAPS.md` (consolidated, individually re-verified list of open issues), `DEVELOPMENT_GUIDELINES.md` (rules for future AI-assisted work on this codebase).
- Status legend standardized across all docs to four tiers: ✅ Implemented / 🟡 Designed, not implemented / ⚠️ Known gap / 🔭 Future.

### Added — Phase 2: Academic Sessions & Grades — complete (2026-08-28, approximate)
All six steps of the original Phase 2 design brief, each independently verified with real evidence (live browser runs, database-level checks, and timing measurements against the actual API routes) — not just typechecked:

1. **Schema** — six new models (`AcademicSession`, `GradeReference`, `SchoolGrade`, `TeacherGradeAssignment`, `GradeHistory`, `GradeHistoryAudit`), additive, `Student.gradeLevel` untouched. 13 `GradeReference` rows seeded (`PP1`–`PP3`, `Y1`–`Y10`).
2. **`recordGradeDecision()`** (`src/lib/gradeHistory.ts`) — sole audited write-path for `GradeHistory` decisions.
3. **`matchLegacyGradeText()`** (`src/lib/gradeMatching.ts`) — free-text-to-grade matching, never guesses, returns `null` on ambiguity.
4. **Initial School Setup** (`/dashboard/setup`) — 5-step wizard: session creation, grade configuration, display names, teacher assignment, student placement (confident-match + manual queue), review.
5. **Student Promotion** (`/dashboard/grades/[schoolGradeId]`) — per-grade roster, bulk Promote/Repeat/Transfer/Leave, every decision audited, transactional bulk writes.
6. **New Session rollover** (`/dashboard/sessions/new`, `/dashboard/grades`) — closes the prior session, opens a new one, auto-carries-forward students with a recorded outcome, and maintains a persistent Pending/Unresolved queue with two distinct resolution paths.

### Fixed — Bulk-write performance and UI correctness during Phase 2 hardening (2026-08-28, approximate)
- Wrapped the `grade-placements` and `teacher-assignments` bulk-write loops in a single `prisma.$transaction`, cutting a 200-row batch from ~15.3s to ~177ms (~86x). Documented the SQLite-vs-Postgres transaction-abort caveat this pattern relies on.
- Fixed the `SetupWizard`'s session-creation flow to actually surface `alreadyActive: true` to the School Admin (previously silently discarded their input and advanced anyway) — now shows a dismissible notice naming the existing session, verified live with a genuine two-tab race condition.
- Fixed a grammar bug in the Promotion roster's success messages ("Repeatd", "Leaved" from naive string concatenation) — replaced with a proper per-decision message function.

### Added — Certificate redesign
- A true-to-size A4 landscape `CertificateDocument` component: MEGA.EDU wordmark + partner school/organization logo-or-name, full recipient/course/issuer hierarchy, course-vs-grade wording support, conditional instructor line/signature, reserved (unbuilt) QR space.
- `buildCertificateViewModel()` (`src/lib/certificateView.ts`) — snapshot-only view model builder, with live logo lookup as the deliberate exception.
- New route `/dashboard/certificates/[id]/preview`, access-gated to the certificate's recipient or a Platform Admin (verified with three different live sessions).
- "View certificate" links on `TeacherDashboard`/`StudentDashboard` repointed from the plain `/verify/[code]` page to the new designed preview, using the certificate's `id`; the public `/verify/[code]` page was left completely unchanged — both surfaces now serve their distinct audiences.
- Widened the `certificate` prop types on both dashboards to include `id` (the underlying Prisma query already fetched it via `certificate: true`; only the TypeScript type was too narrow).

### Fixed — Skill duplicate prevention
- Added `@@unique([studentId, addedByUserId, name])` to `Skill`, closing a gap where double-clicking "Add Skill" could create duplicate rows. Verified zero existing duplicate rows before applying the constraint.
- The skill-creation route now catches the resulting Prisma `P2002` violation and returns `{ ok: true, alreadyExists: true }` instead of a raw error; the client already treated this as a silent success with no code changes needed.
- Different teachers independently crediting the same student with the same skill remains fully supported (the constraint is scoped per-adder, not per-skill-name alone).

### Added — Platform Admin dashboard
- New `PlatformAdminDashboard.tsx`, replacing the generic "your MEGA ID isn't linked to anything" fallback that Platform Admins previously saw on `/dashboard`.
- Real, live-queried counts only: schools/organizations (total, verified, active, pending), teachers/students (total, approved), courses (total, published), certificates issued, MEGA IDs by role — no invented or placeholder statistics.
- Inline pending-verification queues for schools and organizations, reusing the existing `VerifyButton`/`VerifyOrgButton` components and `/api/admin/*` routes rather than duplicating verification logic.
- A "Platform Insights" panel (originally "Coming soon") that explicitly names metrics not yet computable (revenue/payments, growth trends, moderation actions) instead of hiding or faking them.
- `DashboardHero` gained an optional `title` override so this dashboard could show a static heading instead of the time-of-day greeting, without changing any other role's dashboard.

### Changed — Homepage
- "Explore mega.edu" hero button shortened to "Explore"; recolored to orange for visual distinction from the navy "Register" button.
- The "Register" button is now session-aware: for a logged-in visitor it renders as a non-interactive, visually dimmed element (native tooltip: "You already have a MEGA ID") in the exact same layout position, computed server-side from the same request that renders the rest of the homepage. Logged-out visitors see the original active button, unchanged. "Explore" remains active for everyone. Verified in both states with real login/logout sessions.

### Added — Documentation (initial pass)
- Initial `/docs` structure: this file plus `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE.md`, `USER_ROLES.md`, `MEGA_ID.md`, `PRODUCT_RULES.md`, `CERTIFICATES.md`, `ACADEMIC_SESSIONS.md`, `GRADES_AND_PROMOTION.md`, `COURSES_AND_ENROLLMENTS.md`, `AUTHENTICATION_AND_AUTHORIZATION.md`, `TESTING.md`. (Superseded by the full regeneration entry above once Phase 2 was completed.)

## Baseline (pre-existing at the start of this changelog's coverage)

Everything below existed before the entries above and predates any granular history this changelog can reconstruct — grouped by area, not dated:

- **MEGA ID & roles** — unified `User`/`UserRole` identity, NextAuth credentials+JWT login, the full two-stage registration system (generic + role-specific routes) and post-registration affiliation routes (join-school, link-child, create-for-admin).
- **Schools & Organizations** — directories, profiles, admin/accountant management, Platform Admin verification queues.
- **MEGA Academy** — course authoring (modules/lessons/publish), free-course enrollment, completion tracking, certificate issuance on completion (the original `Certificate` model and `issueCourseCertificate()`).
- **Content** — Programs, News, Opportunities, Resources, Events.
- **Notifications** — the `notify()`/`notifySchoolCommunity()` system and unread-count bell.
- **Identity layer** — Interests and Skills (pre-dating the duplicate-prevention fix above).
- **Original `Certificate` model** — per `schema.prisma`'s own header comment, an earlier, simpler certificate model existed before being replaced by the current recipient/instructor/issuer-split design (with a backfill script, `prisma/backfill-certificates.ts`, still present in the repo for that migration).
