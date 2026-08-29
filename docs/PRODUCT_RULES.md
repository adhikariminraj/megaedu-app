# Product Rules & Architectural Decisions

This document collects every business rule and architectural decision that was **explicitly discussed and approved** during this project's design work — not inferred, not assumed. Each entry states the rule, why it exists, and where it applies. Treat this as the tie-breaker when a future change seems to conflict with existing behavior: if it's here, it was a deliberate choice, not an oversight.

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29 (Phase 3B), against the current codebase. Read this file before modifying any business logic — see [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md).

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

### Section-level teacher assignment and section-level analytics are explicitly deferred, not overlooked ✅
**Rule**: teachers are assigned at the grade level only (`TeacherGradeAssignment`); no `TeacherSectionAssignment` concept was built. No per-section counts, dashboards, or reporting exist either.
**Why**: explicitly decided when approving the Section system — "teachers remain primarily assigned to grades... add section-level teacher assignment only if genuinely necessary. Do not unnecessarily complicate the system," and section-level analytics were named out of scope in the same approval. Both are recorded here so a future request doesn't misread their absence as an oversight.
**Applies to**: the entire Section system. See [KNOWN_GAPS.md](KNOWN_GAPS.md) for how this is tracked as a deferred item, not a bug.

### New placements are creation, not decisions — don't over-audit ✅
**Rule**: when a student is placed into a grade for the first time (Initial Setup) or carried forward automatically into a new session (rollover), that's a direct `GradeHistory` row creation (`status: "ENROLLED"`, no `decidedAt`/`outcomeGradeId`) — **not** a call to `recordGradeDecision()`. Only an actual decision changing an *existing* row's outcome (promotion, repeat, transfer, leave) goes through the audited helper.
**Why**: this was a self-correction made explicitly during design — the first draft of the plan said Initial Setup should call `recordGradeDecision()`, then was corrected on the reasoning that a brand-new row has no "previous state" to audit against; auditing a creation as if it were a decision would be misleading, not more rigorous.
**Applies to**: Initial Setup's student-placement step (`POST /api/schools/[id]/grade-placements`), the New Session rollover's carry-forward sweep (`carryForwardEligibleStudents()` in `src/lib/gradeRollover.ts`), and the Pending/Unresolved queue's "manually place" action (same endpoint, reused). Verified in all three cases: `decidedAt: null` and zero `GradeHistoryAudit` rows on the resulting placements. The same reasoning extends to `grade-placements`' optional `sectionId` — setting a section *at creation time* is likewise not audited; only a change to an already-existing row's section (`reassignSection()`) is.

### Every section reassignment on an existing row is audited through exactly one function ✅
**Rule**: `reassignSection()` (`src/lib/gradeHistory.ts`) is the only code path allowed to change a `GradeHistory` row's `sectionId` once that row already exists. Same shape and same transaction/audit guarantee as `recordGradeDecision()` — reads current state, writes the new section, inserts a `GradeHistoryAudit` row capturing `previousSectionId`/`newSectionId` alongside the row's unchanged `status`/`outcomeGradeId`.
**Why**: keeps section changes held to the same "structurally impossible to change without a record" standard as grade decisions, and keeps the two write paths (decision vs. section) demonstrably independent — neither function touches the other's fields.
**Applies to**: `POST /api/schools/[id]/section-assignments` (bulk, used by both the Setup Wizard and the Promotion roster). Setting a section at *creation* time (`grade-placements`) deliberately does **not** go through it — same "creation isn't a decision" reasoning as the rule below. Verified: an unassigned→A reassignment produced 1 audit row; a later A→B correction on the same row produced a second, preserving both.

### Sections are never auto-copied across sessions or decisions ✅
**Rule**: a `GradeHistory` row's `sectionId` is set only by an explicit action — never inferred, defaulted, or carried over from another row. Concretely: (1) the rollover carry-forward sweep creates every new-session row with `sectionId` absent from the `create()` call, i.e. always `null`, regardless of the student's prior section; (2) `recordGradeDecision()` (Promote/Repeat/Transfer/Leave) never reads or writes `sectionId` on the row it's deciding.
**Why**: explicitly required when approving the Section system design — "we should never lose the ability to understand what section the student was assigned to at a particular point in the academic record" was satisfied by making every section change audited (see above), not by guessing continuity across a promotion or a new session, since a new section name (or even the same name, "Class 6A") in a new session isn't guaranteed to mean the same group of students.
**Applies to**: `carryForwardEligibleStudents()` (`src/lib/gradeRollover.ts`) and `recordGradeDecision()` (`src/lib/gradeHistory.ts`). Verified live: a student assigned to Section A, then promoted, kept `sectionId: A` on their now-`COMPLETED` current-session row (untouched, not cleared) — and reading the rollover sweep's `create()` call directly confirms `sectionId` is structurally never one of the fields it writes.

### No hard-delete path for sections — same "retire by disuse" pattern as the legacy grade field ✅
**Rule**: `Section` has creation and `PATCH` (rename / `isActive` toggle) routes only — no `DELETE` route exists or is planned. A section that's no longer wanted is deactivated, never removed, so every `GradeHistory`/`GradeHistoryAudit` row that ever referenced it stays fully resolvable.
**Why**: explicitly required — "no permanent delete of sections with history" — and generalizes the same reasoning already applied to `Student.gradeLevel` (see above): once real historical records point at something, deleting it creates orphaned or unresolvable history, so retirement is always a status flip, never a removal.
**Applies to**: `Section` and its routes under `src/app/api/schools/[id]/sections/` and `src/app/api/schools/[id]/grades/[schoolGradeId]/sections/`.

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

## Subjects & Teacher Academic Assignment (Phase 3A)

### Subject catalog is school-wide and reusable; grade offering is session-scoped ✅
**Rule**: `Subject` is defined once per school and reused across every grade and every academic session — never duplicated per grade. Which subjects a grade actually offers (`GradeSubject`) is, by contrast, scoped to ONE session: a new session starts with zero `GradeSubject` rows for every grade, and nothing is ever auto-copied from the prior session.
**Why**: explicitly decided when approving Phase 3A — a school-wide catalog avoids re-creating "Mathematics" as a separate row per grade, while session-scoping the offering keeps a past session's curriculum permanently reconstructable even after the school later changes its subject list, the same historical-integrity goal behind every other "don't silently carry forward" rule in this project.
**Applies to**: `Subject` (`POST /api/schools/[id]/subjects`), `GradeSubject` (`POST/DELETE .../grades/[schoolGradeId]/subjects...`).

### A teacher may never hold both a grade-wide and a section-specific assignment for the same subject/grade/session ✅
**Rule**: `TeacherAcademicAssignment.sectionId: null` means grade-wide (every section); a real value means one specific section. For the SAME `(teacherId, academicSessionId, schoolGradeId, subjectId)` tuple, a grade-wide request is rejected if any row already exists for that tuple, and a section-specific request is rejected only if a grade-wide row already exists for it. Enforced in the route (`POST /api/schools/[id]/teacher-academic-assignments`), not the database — SQL unique indexes treat `NULL ≠ NULL`, so a plain `@@unique` cannot catch two grade-wide rows colliding, the same reasoning as the one-`ACTIVE`-session-per-school rule below.
**Why**: explicitly required — "a teacher should either be assigned grade-wide... or to specific sections, but not both simultaneously for the same subject assignment," to prevent an accidental, redundant double-assignment.
**Applies to**: `TeacherAcademicAssignment`. Verified live in both orderings (grade-wide-then-specific and specific-then-grade-wide), plus confirming a different section for the same teacher/subject is unaffected (not a collision).

### Multiple different teachers may overlap on the same subject/grade/section — no hierarchy ✅
**Rule**: two different teachers can both hold a `TeacherAcademicAssignment` for the same subject, grade, and section (or one grade-wide, one section-specific) in the same session. No primary/assistant/substitute teacher concept exists or is planned.
**Why**: explicitly decided — "allow multiple teachers to teach the same Subject in the same Grade/Section/Academic Session. Do not introduce teacher hierarchy... yet."
**Applies to**: `TeacherAcademicAssignment`. The overlap rule above is scoped strictly per-teacher — it never blocks a second, different teacher.

### A teacher can only be assigned to a subject actually offered at that grade this session ✅
**Rule**: `TeacherAcademicAssignment.gradeSubjectId` is a direct FK to the matching `GradeSubject` row — the assignment route resolves it from `(schoolGradeId, subjectId, academicSessionId)` before creating the row, and silently skips the item if no matching offering exists. This makes it schema-impossible to assign a teacher to teach a subject the grade doesn't offer this session.
**Why**: a natural integrity consequence of `GradeSubject` being session-scoped (see above) — without this check, a route could create an assignment referencing a subject/grade/session combination with no corresponding offering at all.
**Applies to**: `POST /api/schools/[id]/teacher-academic-assignments`.

### `requireTeacherAssignment()` is built ahead of its first caller, as shared foundation ✅
**Rule**: `src/lib/authorize.ts` gained `requireTeacherAssignment(schoolId, {academicSessionId, schoolGradeId, sectionId?, subjectId?})` during Phase 3A even though no route calls it yet — it exists so Phase 3B's attendance, homework, teaching-progress, and units/lessons features have a proven, single permission primitive to build on rather than each inventing its own inline check.
**Why**: explicitly requested — "build the requireTeacherAssignment permission helper in Phase 3A... it will become the permission foundation for future modules." Its exact query logic was verified directly (six scenarios against real assignment data) since there's no live route to exercise it through yet.
**Applies to**: any future teacher-facing write route that needs to check "is this teacher actually assigned here" before letting them act. Deliberately does not fold in a School-Admin bypass — a caller wanting "Admin or the assigned Teacher" composes both checks inline, same as `students/[studentId]/skills` already does.

### `Subject`/`GradeSubject`/`TeacherAcademicAssignment` are current-state, not historical — same non-audited pattern as `TeacherGradeAssignment` ✅
**Rule**: none of these three tables is audited, and `GradeSubject`/`TeacherAcademicAssignment` both have real `DELETE` routes — freely re-creatable/removable operational data, not permanent decisions. This is a deliberate contrast with `GradeHistory`/`GradeHistoryAudit`, which remain the one audited, permanent placement record.
**Why**: matches the exact distinction already established for `TeacherGradeAssignment` (never audited, has a real delete route) — Phase 3A's new tables answer "what's the current teaching structure," not "what decision was made and when," so applying the audited pattern to them would be over-engineering, not more rigor (the same reasoning already stated for why Initial Setup placements aren't audited).
**Applies to**: `Subject`, `GradeSubject`, `TeacherAcademicAssignment`.

---

## School Academic Operations (Phase 3B)

### Class/Section Teacher assignment allows grade-wide and section-specific to coexist — the opposite of Phase 3A's overlap rule ✅
**Rule**: `ClassTeacherAssignment` has no overlap-blocking rule between a grade-wide (Grade Class Teacher) and section-specific (Section Teacher) row for the same grade — both may exist simultaneously (e.g. a grade-wide coordinator plus a Section Teacher for each individual section). Uniqueness is on the *slot* (`schoolGradeId, sectionId, academicSessionId`), not the teacher, so at most one Class/Section Teacher per slot, per session — but different slots (the whole grade, and each of its sections) can each have their own holder at once.
**Why**: explicitly decided when approving Phase 3B — "This is valid and should not use Phase 3A's overlap-blocking rule," a deliberate contrast with `TeacherAcademicAssignment`'s own grade-wide/section-specific exclusivity rule.
**Applies to**: `ClassTeacherAssignment` and `POST /api/schools/[id]/class-teacher-assignments`.

### A slot's uniqueness constraint has the same NULL-vs-NULL gap as elsewhere — caught by a live test, fixed before shipping ✅
**Rule**: `@@unique([schoolGradeId, sectionId, academicSessionId])` reliably blocks a duplicate section-specific slot but not a duplicate grade-wide (`sectionId: null`) one, so the create route pre-checks grade-wide requests explicitly, inside the same transaction, before relying on the DB constraint at all.
**Why**: this is the exact same `NULL ≠ NULL` unique-index behavior already documented for `TeacherAcademicAssignment`'s overlap rule — but it was still missed on first pass for `ClassTeacherAssignment` and only caught by a live duplicate-creation test during Phase 3B verification (a second grade-wide Class Teacher was wrongly accepted). Recorded here explicitly as a reminder: **any new model with an optional `sectionId` in its unique key needs this same app-level check**, not just the two places it's been caught so far.
**Applies to**: `ClassTeacherAssignment`. Verified fixed in both a single-request and an in-batch duplicate scenario.

### `requireTeacherAssignment()`'s section scope has three states, not two — corrected before Phase 3B's first real caller ✅
**Rule**: a permission check's `sectionId` scope must distinguish *omitted* ("no section restriction, match any assignment"), *`null`* ("the target is grade-wide — require a grade-wide assignment specifically"), and *a real section id* ("grade-wide OR that exact section covers it"). The original Phase 3A implementation collapsed `null` and *omitted* into the same code path (both are falsy in JavaScript), which never mattered while nothing called the function, but would have wrongly let a section-specific-only teacher pass a check meant to require grade-wide access — exactly the situation a grade-wide `TeachingUnit` creates.
**Why**: found and fixed during Phase 3B, explicitly *before* any Teaching Unit/Test route was built on top of it, per the explicit instruction to verify this semantics rather than assume it. A shared `sectionScopeWhere()` helper in `authorize.ts` now implements the three-way logic for both `requireTeacherAssignment()` and the new `requireClassTeacher()`.
**Applies to**: `requireTeacherAssignment()`, `requireClassTeacher()`, and any future `requireX` helper that accepts an optional `sectionId` scope. Verified independently (six scenarios against real assignment data, for each helper) before any Phase 3B feature depended on either function, and re-confirmed live through a real 403 rejection when a Section Teacher attempted a whole-grade-unscoped action.

### Attendance is once per student per calendar day, never subject-based, and corrections are audited including remarks ✅
**Rule**: `Attendance.date` is a calendar day, `@@unique([studentId, date])` globally (not per-session) — a student has exactly one status for a given day, full stop. Once marked, a status/remarks change goes only through `correctAttendance()`, which updates the row and inserts an `AttendanceAudit` row capturing `previousStatus`/`newStatus`/`previousRemarks`/`newRemarks` together, every time — even a remarks-only edit records status unchanged, and vice versa, so nothing is ever silently overwritten.
**Why**: explicitly required — "Attendance is taken once per student per day. It is not subject-based attendance," plus an explicit follow-up to also audit remarks, not just status, "so they cannot be silently overwritten."
**Applies to**: `Attendance`, `AttendanceAudit`, `correctAttendance()` (`src/lib/attendance.ts`).

### A calendar date is always derived from an explicit client-sent string, never the server's own clock ✅
**Rule**: `Attendance.date` (and any future date-only field) must come from a `"YYYY-MM-DD"` string supplied by the caller, converted via `new Date(dateString)` — the same convention already in place for `AcademicSession.startDate`/`endDate` — never from `new Date()` evaluated server-side.
**Why**: explicitly required — "date handling consistently represents the school's local calendar day" — a server-computed "today" would silently assume the server's own timezone rather than the school's actual local day. Verified live: a client string `"2026-08-29"` round-tripped through the API and came back as `2026-08-29T00:00:00.000Z`, with no drift.
**Applies to**: `POST /api/schools/[id]/attendance` and any future route accepting a calendar date.

### Planned totals live in a separate model from the units themselves ✅
**Rule**: `TeachingPlan.plannedTotal` is not a field added to `TeachingUnit` or computed by simply counting existing unit rows — it's a standalone target on its own model, independently settable before, during, or regardless of how many `TeachingUnit` rows actually exist.
**Why**: explicitly required — "the total should not simply equal the number of TeachingUnit rows currently created" — a school's plan (e.g. "12 chapters planned") and its current progress (e.g. "8 created, 5 completed") are two different facts that must be able to disagree.
**Applies to**: `TeachingPlan`, kept deliberately separate from `TeachingUnit`.

### Display terminology (Unit vs. Chapter) is a plain string field, never a second model or an enum ✅
**Rule**: `TeachingPlan.unitLabel` is free text (defaulting to `"Unit"`), never validated against a fixed list and never implemented as a separate `Unit`/`Chapter` model pair.
**Why**: explicitly required — "support either display terminology... without requiring separate underlying database models." A plain string satisfies this directly; anything more structured would be over-engineering for a display preference.
**Applies to**: `TeachingPlan.unitLabel`.

### A Unit/Chapter Test can only be created once its unit has actually started ✅
**Rule**: `POST .../units/[unitId]/tests` returns `400` if the parent `TeachingUnit.status` is still `NOT_STARTED` — a test may only be created once the unit is `IN_PROGRESS` or `COMPLETED`.
**Why**: explicitly required as a design preference — a test for material that hasn't been taught yet doesn't make sense.
**Applies to**: `POST /api/schools/[id]/units/[unitId]/tests`. Verified live: rejected for a `NOT_STARTED` unit, accepted once the same unit was moved to `IN_PROGRESS`.

### A test's student roster is fixed at creation time, not computed later ✅
**Rule**: `UnitTestResult` rows are pre-created (`status: "PENDING"`) for every student currently enrolled in the test's scope (via `GradeHistory`, matching the unit's grade and, if set, section) at the moment the `UnitTest` is created — never inferred afterward by diffing the current roster against existing results.
**Why**: explicitly approved — "This creates a stable test roster and allows direct tracking of Pending / Evaluated / Absent" — a roster that could silently change after the fact (a transfer, a late enrollment) would make "who's still pending" ambiguous.
**Applies to**: `POST /api/schools/[id]/units/[unitId]/tests`.

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
