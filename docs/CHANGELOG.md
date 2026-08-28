# Changelog

All notable changes to MEGA.EDU are recorded here, in [Keep a Changelog](https://keepachangelog.com/) style (`Added` / `Changed` / `Fixed`), newest first.

**A note on how this file was built**: the git history for this project is a single squashed `Initial commit` — there is no granular commit-by-commit history to generate this changelog from mechanically. What follows is a hand-written reconstruction of the real, verified milestones, grouped by feature area. Where a date is given below, it's inferred from the development session's own context (not a git commit timestamp) and should be read as approximate, not authoritative. **Going forward, add a dated entry here for every notable change** — that's the only way this file stays trustworthy once real commit history exists to lean on instead.

## Unreleased

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
