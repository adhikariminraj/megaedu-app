# Product Rules & Architectural Decisions

This document collects every business rule and architectural decision that was **explicitly discussed and approved** during this project's design work — not inferred, not assumed. Each entry states the rule, why it exists, and where it applies. Treat this as the tie-breaker when a future change seems to conflict with existing behavior: if it's here, it was a deliberate choice, not an oversight.

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase. Read this file before modifying any business logic — see [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md).

---

## Data integrity & migration discipline

### Never use a Prisma `enum` ✅
**Rule**: every status/type/role field is a plain `String`, with valid values documented in a comment above the field.
**Why**: SQLite's Prisma connector doesn't support native enums, even unused ones — this broke a migration once ("this bit us once already in Phase 1") and the rule was carried forward explicitly into Phase 2's design brief.
**Applies to**: every model in `schema.prisma` — `UserRole.role`, `School.subscriptionTier`, `Certificate.issuerType`, `AcademicSession.status`, `GradeHistory.status`, etc.

### Additive-first migrations, verify before cleanup ✅
**Rule**: new schema changes are added without touching existing fields/models first. Before applying anything that could conflict with existing data (like a new `@@unique` constraint), write a one-off script, run it against the real database, confirm there's no conflicting data, *then* apply and delete the script.
**Why**: established during the `Skill` duplicate-prevention fix (checked for existing duplicate rows before adding `@@unique([studentId, addedByUserId, name])`) and restated as the required approach for the entire Phase 2 schema addition.
**Applies to**: all schema changes going forward.

### Bulk writes use one transaction, not a loop of individual commits — but the duplicate-skipping pattern inside it is SQLite-specific ⚠️
**Rule**: a bulk write (many rows, each individually validated/skipped on conflict) runs as one `prisma.$transaction(async (tx) => {...})` with a per-item try/catch inside it, not a bare `for` loop of unwrapped `prisma.create()` calls. Measured directly: on `grade-placements`/`teacher-assignments`, 200 sequential unwrapped creates took ~15.3s (~77ms/row) vs. ~177ms (~0.9ms/row) wrapped in one transaction — ~86x faster. The same pattern was built transactional *from the start* for `grade-decisions` (100 students, 328ms real HTTP call) and the session rollover sweep (120 students, 365ms real HTTP call).
**Why this needs revisiting before Postgres**: the per-item try/catch relies on a caught statement error (e.g. a unique-constraint violation) *not* poisoning the rest of the transaction — verified true on SQLite (a deliberate collision-then-continue test still committed the row that came after the collision). **This is not true on Postgres**: there, any failed statement aborts the whole transaction until an explicit `ROLLBACK`/`SAVEPOINT`, so every subsequent `tx.create()` call would itself start failing and get miscounted as `skipped` even when it was actually valid. Since `.env.example`/`schema.prisma` both mark Postgres as the intended production target, **this pattern must be re-checked (likely reworked to pre-filter duplicates before the transaction) before that migration**. Full list of affected routes in [KNOWN_GAPS.md](KNOWN_GAPS.md).
**Applies to**: `POST /api/schools/[id]/grade-placements`, `POST /api/schools/[id]/teacher-assignments`. **Not applicable** to `grade-decisions` or the rollover sweep, which validate eligibility *before* opening the transaction and never intentionally hit a duplicate mid-transaction — a genuinely different, Postgres-safe pattern (see below).

### Legacy fields are retired by disuse, not by deletion ✅
**Rule**: `Student.gradeLevel` stays in the schema permanently as a fallback, simply no longer written to once a school completes Phase 2 setup — it is explicitly *not* a field with a breaking migration planned.
**Why**: different schools will adopt the structured grade model at different times in a real deployment, so there is no single moment where dropping the field is safe for everyone at once.
**Applies to**: `Student.gradeLevel` specifically; the same reasoning should be applied to any future "structured replacement for a free-text field" situation.

---

## Snapshot fields vs. live lookups

### Freeze display text at the moment it matters; never live-lookup identity data into a permanent record ✅
**Rule**: when a record represents a permanent, potentially-shared/printed fact (a certificate, an audit trail entry), any text that names another entity (a person, school, or organization) is copied into a `*Snapshot` field at creation time, not read live through a foreign key relation each time it's displayed.
**Why**: a later rename (a school changing its name, a course being retitled) must never silently alter something that's already been issued or already happened. This was the founding design decision behind the `Certificate` model's `recipientNameSnapshot`, `recipientMegaIdSnapshot`, `issuerNameSnapshot`, `associatedSchoolNameSnapshot`, `instructorNameSnapshot` fields, and was explicitly re-applied and confirmed correct when designing `GradeHistoryAudit`'s `previousStatus`/`previousOutcomeGradeId`/`newStatus`/`newOutcomeGradeId` as plain strings rather than live FK relations to `SchoolGrade`.
**Applies to**: `Certificate` (all `*Snapshot` fields), `GradeHistoryAudit` (all `previous*`/`new*` fields).

### Logos are the deliberate exception — always live ✅
**Rule**: unlike name/text fields, a logo is looked up live from the referenced record (`School.logoUrl`), never snapshotted.
**Why**: a school/organization updating its logo should apply retroactively to how their name is displayed everywhere, including on previously-issued certificates — this is the opposite instinct from the name-freezing rule above, and was deliberately called out as such.
**Applies to**: `CertificateDocument`'s partner-logo rendering (`buildCertificateViewModel` in `certificateView.ts`).

### Never hand-type or guess a logo/name; degrade gracefully when the real field is empty ✅
**Rule**: a school/organization's logo on a certificate must come from that record's actual `logoUrl` field — never invented, never a placeholder image. When it's genuinely absent (as it is for every school/organization today — `Organization` has no `logoUrl` field at all, and no `School.logoUrl` is populated anywhere), show the entity's name in an elegant text treatment instead of a broken image or empty box.
**Why**: stated explicitly as a requirement for the certificate template; generalizes to any future feature that displays an optional uploaded asset.
**Applies to**: `CertificateDocument.tsx`'s partner-logo block.

---

## The "one audited/gatekept write path" pattern

### Every certificate is issued through exactly one function ✅
**Rule**: `issueCourseCertificate()` (`src/lib/certificates.ts`) is the only code path that may create a `Certificate` row for a course. It guarantees the snapshot fields are always populated at issuance.
**Applies to**: currently called only from the enrollment-completion route, atomically alongside marking the enrollment complete (same transaction) — "an enrollment should never end up 'complete' with no certificate, or vice versa."

### Every GradeHistory decision is audited, including the first one ✅
**Rule**: `recordGradeDecision()` (`src/lib/gradeHistory.ts`) is the only code path allowed to change a `GradeHistory` row's `status`/`outcomeGradeId`. Every call, in one transaction, updates the row **and** inserts a `GradeHistoryAudit` row capturing the previous and new state — including the very first decision ever recorded on a row, not just later corrections.
**Why**: makes it structurally impossible to change a grade decision without leaving a record. Verified repeatedly: an isolated first-decision test (0 audits before, 1 after, correct previous-state capture); a real 100-student bulk Promotion batch through the actual API route producing exactly 100 matching audit rows.
**Applies to**: ✅ the Student Promotion workflow (`/dashboard/grades/[schoolGradeId]`, `POST /api/schools/[id]/grade-decisions`) is the only feature that calls this. Initial Setup's first-time placements deliberately do **not** go through it — see the next rule.

### New placements are creation, not decisions — don't over-audit ✅
**Rule**: when a student is placed into a grade for the first time (Initial Setup) or carried forward automatically into a new session (rollover), that's a direct `GradeHistory` row creation (`status: "ENROLLED"`, no `decidedAt`/`outcomeGradeId`) — **not** a call to `recordGradeDecision()`. Only an actual decision changing an *existing* row's outcome (promotion, repeat, transfer, leave) goes through the audited helper.
**Why**: this was a self-correction made explicitly during design — the first draft of the plan said Initial Setup should call `recordGradeDecision()`, then was corrected on the reasoning that a brand-new row has no "previous state" to audit against; auditing a creation as if it were a decision would be misleading, not more rigorous.
**Applies to**: Initial Setup step 5 (`POST /api/schools/[id]/grade-placements`), the New Session rollover's carry-forward sweep (`carryForwardEligibleStudents()` in `src/lib/gradeRollover.ts`), and the Pending/Unresolved queue's "manually place" action (same endpoint, reused). Verified in all three cases: `decidedAt: null` and zero `GradeHistoryAudit` rows on the resulting placements.

### The carry-forward sweep is idempotent and re-runnable, not a one-shot ✅
**Rule**: `carryForwardEligibleStudents()` can be safely called more than once against the same target session — re-running it after nothing has changed places zero additional students and throws no error, because it always checks "does this student already have a row in the target session" before creating one.
**Why**: resolving a Pending/Unresolved student can happen at any point after a new session already exists (record their missing decision today, next week, whenever) — the sweep needs to be re-runnable on demand (a "Place eligible students now" button), not just fired once automatically at rollover time.
**Applies to**: `POST /api/schools/[id]/grade-rollover` (on-demand re-run) and the automatic call inside `POST /api/schools/[id]/academic-sessions/rollover`. Verified directly: first run placed 10/10 eligible students; an immediate second run with no state changes placed 0, threw no error, and a duplicate check confirmed zero students with more than one row in the target session.

---

## Never guess when confidence is low

### Legacy grade-text matching returns null, not a best-effort guess ✅
**Rule**: the utility that matches free-text grade values (`"Grade 6"`, `"Class 6"`, `"VI"`, `"Nursery"`) to a `GradeReference` code must return `null` — not a low-confidence guess — whenever it can't confidently match. Unmatched students go to a manual-assignment queue, never a silently wrong auto-match.
**Why**: stated as an explicit requirement; wrong auto-placement into a grade is worse than requiring a human to resolve it.
**Applies to**: `matchLegacyGradeText()` (`src/lib/gradeMatching.ts`), used during Initial School Setup step 5. Verified with 20+ real inputs, including confirming the full Roman numeral range (I–X, including subtractive notation IV/IX) resolves correctly, and that genuinely ambiguous input (`"KG"` alone, `"Room 6B"`, out-of-range numbers) correctly returns `null`.

### Students without a recorded decision are never silently defaulted ✅
**Rule**: when starting a new `AcademicSession`, any student whose most recent `GradeHistory` row is still `ENROLLED` (no decision ever recorded — not `outcomeGradeId` set) must be excluded from automatic placement into the new session entirely, and instead listed in a clearly visible, **persistent** Pending/Unresolved queue. The School Admin must explicitly resolve each one before that student gets a grade in the new session.
**Why**: the same "never guess" principle applied to session rollover — an unresolved student silently carried forward (or silently left out) would hide a real gap in the school's record-keeping.
**Applies to**: `findPendingStudents()` (`src/lib/gradeRollover.ts`), surfaced on `/dashboard/grades`. Deliberately session-agnostic: it always looks at a student's *true most recent* `GradeHistory` row, however many sessions back that is — verified across a real 3-session chain where a student pending after session A→B remained correctly pending (referencing session A, not the empty intervening session B) after a second rollover B→C.

### A pending student can be resolved two different ways, both legitimate ✅
**Rule**: (1) "Record the missing decision" — go back to the student's old, now-closed session roster and apply a real Promote/Repeat/Transfer/Leave decision (audited via `recordGradeDecision()`), then a follow-up sweep places them in the new session. (2) "Manually place them" — place them directly into the current session without ever deciding the old row; the old row stays permanently `ENROLLED` with zero audit rows, an honest gap rather than a fabricated decision.
**Why**: both were explicitly specified as valid resolutions; forcing only one path would either lose historical accuracy (if manual placement were disallowed) or block legitimate fast-path corrections (if only the audited path were allowed).
**Applies to**: the Pending/Unresolved queue's two actions on `/dashboard/grades`. Verified with both paths exercised on different students in the same test run, confirmed distinguishable at the database level by audit-row count (1 vs. 0).

---

## Access control

### Every write route is gated by a `requireX` helper that returns the userId or null ✅
**Rule**: no route inlines its own ad-hoc permission check against `session.user.roles` for admin-style access — it calls a shared `requireSchoolAdmin` / `requireOrgAdmin` / `requireCourseOwner` / `requirePlatformAdmin` / `requireSchoolFinance` / `requireOrgFinance` from `src/lib/authorize.ts`.
**Why**: keeps the permission logic in one place per relationship type, testable and auditable independently of any one route. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).
**Applies to**: every `/api/schools/[id]/*`, `/api/organizations/[id]/*`, `/api/admin/*`, and course-content write route — including every Phase 2 route added since.

### Finance access is additive to Admin, never a substitute check for it ✅
**Rule**: `requireSchoolFinance`/`requireOrgFinance` deliberately check **both** the Admin link and the Accountant link — an Admin retains full authority (finance included), while a pure Accountant (not also an Admin) gets finance access **only**. Nothing outside finance-scoped routes should ever call these functions to gate a non-finance action.
**Applies to**: the Finance tab in `OrgDashboard`/`DashboardClient`, `AccountantDashboard`.

### A certificate's designed preview is recipient-or-platform-admin only ✅
**Rule**: `/dashboard/certificates/[id]/preview` checks `certificate.recipientUserId === userId` **or** `PLATFORM_ADMIN` role — never viewable by an arbitrary logged-in user who guesses an id. This was verified live with three different sessions (recipient, platform admin, unrelated teacher — the last one correctly redirected away).
**Applies to**: the certificate preview route only.

---

## Certificate system: two verification surfaces, kept deliberately separate

### `/verify/[code]` and the certificate preview serve different audiences and must both keep working ✅
**Rule**: `/verify/[code]` is the public, no-login-required page for a third party (an employer, another school) to confirm a certificate is real — plain text, unstyled, permanent. The designed `CertificateDocument` preview at `/dashboard/certificates/[id]/preview` is for the certificate owner viewing their own achievement. Neither replaces the other; dashboards link "View certificate" to the owner-facing preview, while the plain page remains reachable by its code-based URL for sharing.
**Why**: explicitly stated as two different purposes serving two different audiences, not a redundant older/newer pair.
**Applies to**: `src/app/verify/[code]/page.tsx` (must never be modified casually) and `src/components/certificate/CertificateDocument.tsx`.

### Skill duplicate-prevention: same person + same skill + same student = duplicate; different people = independent attestation ✅
**Rule**: `@@unique([studentId, addedByUserId, name])` on `Skill` — a teacher double-clicking "Add Skill" can't create a duplicate row, but two different teachers independently crediting the same student with the same skill is meaningful and must both be recorded.
**Why**: multiple attestations from different people carry real information (corroboration); the same person repeating an action is just an accident to be prevented.
**Applies to**: `Skill` model and its creation route, which catches the resulting `P2002` constraint violation and returns `{ ok: true, alreadyExists: true }` rather than a raw error — the client treats this identically to a successful add.

---

## Session-aware UI, without duplicating auth logic

### The homepage Register button is session-aware, computed server-side, no client auth re-check ✅
**Rule**: the homepage hero's Register button becomes a non-interactive, visually dimmed element (native `title` tooltip, no `href`, `aria-disabled`) when the visitor is already logged in, computed from `getServerSession` in the same server component that renders the rest of the homepage — not a second client-side session check.
**Why**: keeps a single source of truth for "is this visitor logged in" per page render, avoids a flash-of-wrong-state on load.
**Applies to**: `src/app/page.tsx`.

---

## Reporting incomplete data honestly

### Never show a placeholder statistic — omit it or explicitly label it "coming soon" ✅
**Rule**: the Platform Admin dashboard's "Platform Insights" panel explicitly lists metrics that can't yet be computed (revenue/payments, growth trends, moderation actions) with the reason why, rather than fabricating a number or hiding the gap silently.
**Why**: stated as a hard requirement when building the dashboard — "use only data and actions that already exist in the system... where a metric cannot yet be calculated from existing data, leave it out or clearly mark it as a future dashboard item."
**Applies to**: `PlatformAdminDashboard.tsx`, and by extension, this documentation's own status-tagging convention.

---

## Course access & commerce — what's actually decided vs. not

### Free enrollment is implemented; nothing about pricing structure has been decided yet 🔭
**Rule**: `Course.priceCents` exists and defaults to `0`; enrollment for a free course works end-to-end. Enrollment for a course with `priceCents > 0` is **explicitly blocked** with an error message — no payment flow exists to complete it.
**What is *not* an approved rule, despite sounding like it should exist by now**: there is no "Free vs. Premium course" tier system, no "course bundle by grade" concept, and no defined "enrollment access method" beyond the single free-enrollment path described above. A direct search of the codebase for any bundle/premium/tier concept turned up nothing, and no prior design discussion in this project's history approved one either. If a future request asks to "preserve" these as existing rules, that request is working from an incorrect premise — check here first rather than assuming they were previously decided.
**Applies to**: `POST /api/courses/[courseId]/enroll`. See [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md) and [KNOWN_GAPS.md](KNOWN_GAPS.md).
