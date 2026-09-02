# Grades & Promotion

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-31 (Class Overview — Teachers, Sections, and Ranking), against the current codebase.
> See [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) for the session side, [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) for Phase 3A's Subjects & Teacher Academic Assignment (built on top of the grade/section structure documented here), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md) for Phase 3B's Grade Coordinators/Class Teachers, Attendance, Teaching Units, and Unit Tests, [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md) for the ranking calculation the Class Overview reuses, and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles (snapshot fields, never-guess matching, audited decisions, and the `CURRENT_ROSTER_STATUSES` rule).

## Why this exists ✅

`Student.gradeLevel` is a free-text field — schools historically typed "Grade 6", "Class 6", "VI", whatever they liked, with no structure and no history. Phase 2 replaces this with a structured, auditable model, while leaving `gradeLevel` in place permanently as a legacy fallback (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) — schools adopt the new structure on their own timeline, and nothing forces a breaking migration.

## Schema ✅

Seven models total (`AcademicSession` has its own doc). Full field lists in [DATABASE.md](DATABASE.md).

- **`GradeReference`** — the platform-wide, fixed grade ladder. Seeded once: `PP1, PP2, PP3, Y1, Y2, ..., Y10` (13 rows, `order` 1–13). Not school-editable.
- **`SchoolGrade`** — a school's opt-in to one `GradeReference`, with its own `displayName` (e.g. `"Class 6"` for `Y6`).
- **`Section`** — an optional, school-defined subdivision of a `SchoolGrade` (e.g. Class 6 → A, B, C). Unlimited per grade, unique name per grade, soft-deactivate only.
- **`TeacherGradeAssignment`** — per-session teacher-to-grade link.
- **`GradeHistory`** — a student's grade placement for one session; the permanent record. Unique on `(studentId, academicSessionId)`. Optional `sectionId`.
- **`GradeHistoryAudit`** — append-only log of every decision ever written to a `GradeHistory` row, including section reassignments.

## The audited write-path: `recordGradeDecision()` ✅

`src/lib/gradeHistory.ts` — the **only** code path anywhere in the app allowed to change a `GradeHistory` row's `status`/`outcomeGradeId`. In one transaction: reads the current state, writes the new state, inserts a `GradeHistoryAudit` row capturing both — including the very first decision ever made on a row, not just later corrections. Rejects an invalid status before writing anything.

**Verified**: a targeted test isolated exactly the "first decision" case — 0 audit rows before, 1 after, `previousStatus: "ENROLLED"`, `previousOutcomeGradeId: null` captured correctly.

## The audited write-path for sections: `reassignSection()` ✅

Also in `src/lib/gradeHistory.ts` — the **only** code path allowed to change a `GradeHistory` row's `sectionId` once that row already exists. Same shape as `recordGradeDecision()`: reads the current state, writes the new `sectionId`, inserts a `GradeHistoryAudit` row capturing both `previousSectionId`/`newSectionId` **and** the row's current `status`/`outcomeGradeId` unchanged (a section reassignment never touches the decision fields, and a decision never touches the section field — the two are fully independent write paths on the same row). Optionally composes into a caller's own transaction via `tx?: Prisma.TransactionClient`.

**Verified**: assigning a section to a previously-unassigned row produced exactly 1 audit row (`null → <sectionId>`), decision fields unchanged; a genuine correction (A → B) on an already-assigned row produced a *second* audit row, preserving the full chronology rather than overwriting the first.

## The legacy matching utility: `matchLegacyGradeText()` ✅

`src/lib/gradeMatching.ts` — matches free text (`"Grade 6"`, `"Class 6"`, `"VI"`, `"Nursery"`, `"UKG"`) to a `GradeReference` code. Handles the full Roman numeral range I–X including subtractive notation (`IV`→4, `IX`→9 — verified explicitly, not assumed), ordinal suffixes (`"6th Grade"`), and pre-primary keywords (`nursery`→`PP1`, `lkg`→`PP2`, `ukg`→`PP3`). **Returns `null` — never a guess — for anything ambiguous or out of range** (`"Grade 11"`, `"KG"` alone, `"Room 6B"`, spelled-out numbers): verified with over 20 real inputs including deliberately tricky ones.

## Initial School Setup — 7-step guided flow ✅

`/dashboard/setup`, gated by resolving the School Admin's own school (same access pattern as every other school-admin surface). Verified end-to-end live, with a real mix of matchable and unmatchable student records.

1. **Session** — create the school's first `AcademicSession` if none exists yet.
2. **Configure grades** — pick which `GradeReference`s the school uses, creating `SchoolGrade` rows. `POST /api/schools/[id]/grades`.
3. **Display names** — set each grade's label, defaulting to the code, editable. Same endpoint as step 2.
4. **Create sections (optional)** — per grade, bulk-add section names (comma-separated, e.g. `A, B, C`); a grade with no sections created works exactly as before — sections are opt-in. `POST /api/schools/[id]/grades/[schoolGradeId]/sections`.
5. **Assign teachers** — bulk-pick teacher → grade(s) for the current session. `POST /api/schools/[id]/teacher-assignments`. (Section-level teacher assignment was considered and deliberately left out — see [Sections](#sections-) below.)
6. **Assign students** — runs `matchLegacyGradeText()` against every approved student's `gradeLevel`. Confident matches are pre-filled for one-click bulk confirmation; everything else goes into a manual queue with multi-select + bulk-assign. `POST /api/schools/[id]/grade-placements` — **a direct `GradeHistory` creation, `status: "ENROLLED"`, not routed through `recordGradeDecision()`**, since a first-time placement isn't a decision changing an existing row (see [PRODUCT_RULES.md](PRODUCT_RULES.md) for why this distinction matters). Once a grade has active sections, a separate "Assign Sections" panel on the same step lets the admin place already-placed students into a section — a distinct action, not part of the grade-matching flow.
7. **Review & confirm** — live counts (grades configured, teachers assigned, students placed, students still unmapped).

Verified with a real 5-student scenario: matching split 3 confident / 2 manual exactly as designed; database-level check confirmed all 5 resulting rows had `decidedAt: null` and produced **zero** `GradeHistoryAudit` rows, proving the direct-creation path was actually used.

## First-time grade placement — four entry points, one shared architecture ✅

A student's *first* `GradeHistory` row for a session can now be created four ways. All four are the same "creation isn't a decision" architecture — direct `GradeHistory.create()`, `status: "ENROLLED"`, no `decidedAt`, never routed through `recordGradeDecision()` — never a fifth, parallel mechanism:

1. **Initial Setup step 6** — confident-match/manual queue, bulk, via `POST /api/schools/[id]/grade-placements`.
2. **Pending/Unresolved queue's "manually place"** — bulk, same `grade-placements` route, reused as-is.
3. **Add Student, optionally, at creation time** — a School Admin can pick a grade (and, once one is picked, a section) directly on the `+ Add Student` form. This does **not** call `grade-placements` — it's an inline `GradeHistory.create()` inside `POST /api/schools/[id]/students`' own transaction, same validated shape (session/grade/section must belong to the school; section must be `isActive` and belong to that grade) and same unaudited-creation rule, but a structurally separate call site from the other three. Left blank, the student is created with no placement at all.
4. **Students tab's "Assign Grade & Section →" action** — for any approved student with no `GradeHistory` row in the active session (most commonly a student added via #3 with no grade picked, but works for any such student regardless of how they were created). This one **does** reuse `grade-placements` directly, as a single-item `placements` array — no new route was written for it.

**Verified live** (this task, not assumed): created a student via Add Student with no grade → showed "Assign Grade & Section →", not "Change Section →". Used it to place them into Class 9 / Section A → database check confirmed exactly one `GradeHistory` row, `status: "ENROLLED"`, `decidedAt: null`, and **zero** `GradeHistoryAudit` rows. Then used the now-available "Change Section →" control to move them to Section B → succeeded, and the audit count became exactly **one**, capturing only that reassignment — confirming the four-entry-point creation path and the audited reassignment path stay as cleanly separated as the rest of this document describes for Sections generally.

## Student Promotion workflow — per grade, per session ✅

`/dashboard/grades/[schoolGradeId]` — a School Admin opens one `SchoolGrade`'s Class Overview for the active session (see [Class Overview](#class-overview--teachers-sections-and-ranking-) below for everything the page shows beyond the promotion panel itself), multi-selects students from the roster, and applies one decision to the whole selected batch. **The decision panel's own eligibility is deliberately narrower than the page's roster** — see [Class Overview](#class-overview--teachers-sections-and-ranking-) for the distinction; only a still-`ENROLLED` row can actually be decided, whether or not other, already-decided students are also visible on the same page:

| Decision | `GradeHistory.status` | `outcomeGradeId` | Meaning |
|---|---|---|---|
| **Promote** | `COMPLETED` | required — the target grade | Student finished this grade and moves up |
| **Repeat** | `REPEATED` | required — same grade as today | Student stays in this grade next session |
| **Transfer** | `TRANSFERRED` | none | Student leaves this school for another |
| **Leave** | `LEFT` | none | Student leaves this school entirely |

**Example: `Y6 → Y7`** — a School Admin opens the Grade 6 roster, selects a group of students, clicks Promote. The default suggested target grade is the nearest later `GradeReference` the school has actually configured (`Y7`, by `order`) — shown pre-selected in an editable dropdown, so the admin can override it (e.g. skip a grade, or promote into a grade out of strict sequence) if that's genuinely the right call.

**Example: `Y6 → Repeat Y6`** — same roster, Repeat instead. The dropdown defaults to the *current* grade rather than the next one.

**Example: `Y6 → Transfer`** / **`Y6 → Leave`** — no grade dropdown appears at all; these decisions record why the student is no longer part of this school's grade progression, with no destination grade.

**Bulk selection**: every decision applies to the *entire currently-selected set* in one action — there's a "select all" toggle, and each student can be checked/unchecked individually. **Every row in the batch goes through `recordGradeDecision()` inside one `prisma.$transaction`** (built transactional from the start for this step, per an explicit requirement) — verified with a real 100-student batch: 328ms total, `decided: 100, skipped: 0`, and a database check confirmed exactly 100 matching `GradeHistoryAudit` rows.

**Individual outcomes within one submission**: not supported — one decision type and one outcome grade apply to the whole selected batch per submission. To give different students different outcomes, submit separate batches (e.g. select the promoted group, apply Promote; then select the repeaters, apply Repeat).

**Eligibility is re-checked server-side, not just trusted from the UI**: submitting a `gradeHistoryId` that's already been decided (or doesn't belong to the school) is silently excluded and counted in `skipped`, never double-decided. Verified with a mixed batch (one already-decided id + one genuinely eligible id): `{decided: 1, skipped: 1}`, and the already-decided row's audit count stayed at exactly 1.

**The final-grade edge case**: promoting a student already in the school's highest configured grade shows no default target (empty dropdown, not a bad guess), with an explanatory note ("No later grade is configured..."), and blocks submission with a clear error until the admin picks a grade manually or chooses a different decision. Verified live.

**Promotion is completely independent of section**: applying a decision (Promote/Repeat/Transfer/Leave) never reads or writes the row's `sectionId` — the roster's "Apply Decision" button and its separate "Assign Section" panel hit entirely different endpoints (`grade-decisions` vs. `section-assignments`), share only the same checkbox selection, and can be used in either order or independently. Verified live: a student assigned to Section A, then promoted to the next grade, kept `sectionId` unchanged on their (now-`COMPLETED`) current-session row — promotion neither cleared it nor moved it anywhere. See [Sections](#sections-) below for what happens to section on the *new* session's row.

## Class Overview — Teachers, Sections, and Ranking ✅

`/dashboard/grades/[schoolGradeId]` (`page.tsx` + `PromotionRoster.tsx`) is both the Promotion action panel described above *and* a broader Class Overview — a School Admin opening one grade sees who's currently in it, who teaches what, and (once results exist) how the class is performing, not just an action list.

### The current-roster definition — `CURRENT_ROSTER_STATUSES` ✅

**Corrected from an earlier, narrower version of this page**: the roster is *not* `GradeHistory.status: "ENROLLED"` alone. `CURRENT_ROSTER_STATUSES` (`src/lib/gradeHistory.ts`) — `["ENROLLED", "COMPLETED", "REPEATED"]` — is the single, shared definition of "physically in this grade for the rest of this session," used identically by this page's roster query and by the Grades index's own "N enrolled" card count (`/dashboard/grades/page.tsx`), so the two can never disagree.

**Why `COMPLETED`/`REPEATED` are included, not just `ENROLLED`**: a decision about *next* session (`COMPLETED` = promoted, `REPEATED` = repeating) doesn't remove a student from *this* grade the moment it's recorded — the school year isn't over, and the student is still sitting in class. Excluding them the moment a decision is recorded would make the roster silently shrink mid-year, well before the year actually ends. This was found as a real, live bug during Class Overview development: a genuine seed-data row already had a `REPEATED` decision recorded on its *current*-session row, and the old `ENROLLED`-only query made that student invisible on a page that should have shown them.

**Why `TRANSFERRED`/`LEFT` are still excluded**: unlike a promotion or repeat decision, these mean the student has genuinely left the school — there is no "rest of this session" for them to be counted in. They're the only two statuses the current-roster definition treats as truly gone.

**The Promotion action panel's own eligibility stays narrower, deliberately, on purpose**: only a still-`ENROLLED` row can be selected for a *new* decision — `recordGradeDecision()`'s own route (`POST /api/schools/[id]/grade-decisions`) independently re-validates `status === "ENROLLED"` server-side regardless of what the UI shows, silently skipping (never erroring) anything else, exactly as documented above. Broadening the *display* roster to include `COMPLETED`/`REPEATED` students changes nothing about who a decision can actually be applied to — it only makes the page honestly show everyone currently in the grade, decided or not. The separate "Assign Section" panel is not narrowed this way at all — section reassignment has nothing to do with promotion eligibility, so an already-decided-but-still-present student can still have their section corrected.

### Teachers & Subjects ✅

A "Teachers" list above the roster shows every `TeacherAcademicAssignment` for this grade and session — subject, teacher name, and (when the assignment is section-specific rather than grade-wide) which section, so a subject taught differently per section is never misread as grade-wide. No new model — the exact same query shape `/dashboard/academics` already uses.

### Section-wise grouping ✅

Students are grouped by their **current-session `GradeHistory` row's own `sectionId`/section name** — never inferred from an older row — sorted alphabetically by section name, with a final **"Unassigned / No Section"** group (never hidden, never dropped) for anyone with `sectionId: null`. Roll No. (a display-only sequential position, not a stored field — see [KNOWN_GAPS.md](KNOWN_GAPS.md)) restarts at `01` for each section group, matching how real class roll numbers work. A newly-admitted or repeated student placed into a real section appears correctly grouped with no special-case logic — the grouping is a pure function of the same `sectionName` every row already carries.

### The "Repeated" badge — derived, never guessed ✅

A student's Status badge ("Regular" or "Repeated") reflects only their **prior-session** `GradeHistory` row: `Repeated` if that row's `status === "REPEATED"` **and** its `outcomeGradeId` equals the grade being viewed — i.e., they were decided to repeat *into* this exact grade. A student with no prior row at all (a fresh admission) is `Regular` by definition. This is deliberately independent of the student's own *current*-session row's status — a student who has already been decided `REPEATED` for *next* session still shows `Regular` today unless their *own* arrival into this grade was itself a repeat; conflating the two would misreport a forward-looking decision as a description of how the student got here. Verified live with both cases present simultaneously in the same roster.

### Top 5 ranking — grade-wide, never re-scored per section ✅

Ranking is computed **once, across the whole grade**, before any section grouping happens — a section's own display is purely a rendering concern, so a Section A student and a Section D student can legitimately hold Rank 1 and Rank 2 on the same page. The ranking basis and the numbers themselves come entirely from the existing central calculation engine (`fetchAssessmentResults()`/`computeUnweightedGPA()`/`computeUnweightedAveragePercentage()`, `src/lib/assessmentResults.ts` — see [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md)), filtered to **published results only**; a student with zero published subjects has no score and is excluded from ranking entirely, not ranked last. Nothing is persisted — recalculated on every page load. Badges: 🥇 Rank 1 / 🥈 Rank 2 / 🥉 Rank 3 / Rank 4 / Rank 5, each paired with a distinct highlight color on the row, never color alone. Before any result is published anywhere in the grade, the page shows "Student rankings will appear after the first assessment results are published" instead of an empty or misleading ranking.

### Back button ✅

Replaces the earlier plain "← All grades" link with a `← Back` control that prefers real browser history (`router.back()`) when the visit genuinely came from elsewhere in the app (`document.referrer` same-origin and real history depth), falling back to `/dashboard/grades` only for a direct/bookmarked load with nothing to go back to. Verified both branches live.

### Authorization — unchanged ✅

Every addition above reuses the page's existing `requireSchoolAdmin`-gated access exactly as it already was — School-Admin-only, same as the Promotion panel it extends. No new role gets access to this page, and published-results-only filtering for ranking means nothing beyond what a School Admin can already see elsewhere (the Student Profile page, `/dashboard/assessment-results`) is newly exposed.

## Undecided students & next-session activation ✅

A student who is never decided stays `ENROLLED` in their current session's `GradeHistory` row indefinitely — nothing forces a decision. When the School Admin starts a new session (rollover), that student is **excluded from automatic placement** and appears in the persistent **Pending/Unresolved** queue on `/dashboard/grades`, which stays visible for as long as they remain unresolved — not just at the moment of rollover.

Two ways to resolve a pending student, both implemented:
1. **Record the missing decision** — the queue links directly to that student's grade roster, scoped to the closed session (`?session=<id>`), where the admin applies a real decision. This alone doesn't place them in the new session — a follow-up "Place eligible students now" action (or the next rollover) picks them up.
2. **Manually place them** — select the student directly in the queue, pick a grade, and place them into the current session immediately, skipping the old decision entirely. Their old row stays permanently `ENROLLED` with zero audit rows — a deliberate, honest gap in the record (the school chose not to record why), not an error.

**Verified across a 3-session chain** (a specific edge case worth calling out): a student left pending after session A→B remained correctly pending through B→C as well — even though they never had any row in session B at all — and `findPendingStudents()` still correctly traced back to their true last real placement in session A. Resolving them afterward placed them directly into session C, correctly skipping the empty session B.

## Repeated grades ✅

A repeat isn't an edit to the existing row — it's the `REPEATED` decision on the current session's row (with `outcomeGradeId` pointing at the *same* grade), and a **new** `GradeHistory` row gets created in the next session at that grade via the same carry-forward mechanism as a promotion. Nothing is overwritten; the history of "repeated Grade 6 in 2026, then completed it in 2027" is fully preserved across two separate rows. Like a promotion, the carried-forward row for a repeat also starts with `sectionId: null` — a student repeating Grade 6 doesn't automatically stay in their old section; see [Sections](#sections-) below.

## Audit records ✅

Every decision — promote, repeat, transfer, or leave — produces exactly one `GradeHistoryAudit` row, capturing `previousStatus`/`previousOutcomeGradeId` → `newStatus`/`newOutcomeGradeId` and `previousSectionId`/`newSectionId` (carried through unchanged by a decision, but always recorded — see [DATABASE.md](DATABASE.md#gradehistoryaudit)), who (`changedByUserId`) and when (`changedAt`). This table is genuinely append-only: no route anywhere updates or deletes a `GradeHistoryAudit` row. New placements (Initial Setup, rollover carry-forward, manual pending placement) are **not** audited, by design — see [PRODUCT_RULES.md](PRODUCT_RULES.md) for the reasoning. The same is true for a section set *at* creation time (via `grade-placements`' optional `sectionId`): only a change to an already-existing row's section, through `reassignSection()`, is audited.

## Sections ✅

An optional subdivision of a `SchoolGrade` (e.g. Class 6 → A, B, C) — added after the original six-model Phase 2 build, on top of the same `GradeHistory`/audit architecture, with no changes to any existing Phase 2 behavior.

### Lifecycle
A `Section` belongs to a `SchoolGrade`, not to a session — the same section rows persist across every academic session that grade is used in, the same way `SchoolGrade` itself does. Unlimited sections per grade, no fixed maximum. Names must be unique within a grade (`@@unique([schoolGradeId, name])`) but the same name can be reused across different grades (Class 5's "A" and Class 6's "A" are unrelated rows). **No hard-delete path exists at all** — a School Admin can only create sections and toggle `isActive`. A deactivated section keeps its name reserved (you can't rename a different section to reuse it) and keeps every historical `GradeHistory`/`GradeHistoryAudit` reference intact and resolvable; it simply stops appearing as an assignable option going forward.

### Permissions
Everything section-related is School-Admin-only, gated the same way as the rest of Phase 2 (`requireSchoolAdmin(schoolId)`, resolving the admin's own school): creating sections, renaming a section, deactivating/reactivating a section, and assigning a student to a section. No other role has any section-related route today.

### Student placement
Section is placed on the same `GradeHistory` row as the grade itself (`GradeHistory.sectionId`, nullable) — School → Session → Grade → Section, with Section as the optional final layer. It can be set two ways:
- **At creation time**, as an *optional* `sectionId` alongside the required `schoolGradeId`, via any of the four entry points in [First-time grade placement](#first-time-grade-placement--four-entry-points-one-shared-architecture-) above. Not audited, for the same reason the initial `status: "ENROLLED"` isn't (see [PRODUCT_RULES.md](PRODUCT_RULES.md)).
- **On an already-existing row**, via `reassignSection()` / `POST /api/schools/[id]/section-assignments` — a bulk, audited action, available from both the Setup Wizard's students step and the Promotion roster (`/dashboard/grades/[schoolGradeId]`), completely separate from applying a Promote/Repeat/Transfer/Leave decision.

A section passed at either point must be `isActive` and must belong to the *same* `schoolGradeId` as the placement/row — enforced server-side, not just hidden client-side. Verified directly: a raw API call assigning a deactivated section returns `400 {"error": "This section is deactivated."}`; a placement naming an inactive section is silently skipped (counted in `skipped`, not an error), consistent with how `grade-placements` already treats other invalid rows.

### Grade placement behavior
The confident-match / manual-assignment flow in Initial Setup step 6 remains **grade-only** — `matchLegacyGradeText()` has no concept of section (there's no legacy free-text data to match a section against), so every confident/manual match still only resolves a grade. Section assignment for those same students happens afterward, in the separate "Assign Sections" panel on the same step, listing only students already placed into a grade.

### Promotion behavior
Promotion, repeat, transfer, and leave decisions never read or write `sectionId` — see the note in [Student Promotion workflow](#student-promotion-workflow--per-grade-per-session-) above. The Promotion roster's "Assign Section" panel is a second, independent control on the same page, sharing only the roster's checkbox selection with the decision panel, never its submission.

### Sections are not inherited across sessions
**A new session's `GradeHistory` row always starts with `sectionId: null`, regardless of what section the student held in the prior session** — this applies uniformly to a promotion, a repeat, and the automatic rollover carry-forward sweep (`carryForwardEligibleStudents()` in `gradeRollover.ts`). Confirmed by reading the sweep's own `create()` call: it populates `studentId`, `schoolGradeId`, `academicSessionId`, and `status` only — `sectionId` is never one of the fields written, so Prisma leaves it at its schema default (`null`) every time. A school re-assigns sections explicitly each session, the same deliberate way it re-assigns teachers each session via `TeacherGradeAssignment` — nothing is silently carried over, and no assumption is made that "Class 6A" this year means the same group of students as "Class 6A" last year.

### Deliberately out of scope (explicitly deferred, not overlooked)
- **Section-level teacher assignment** — teachers remain assigned at the grade level only (`TeacherGradeAssignment` is unchanged); no `TeacherSectionAssignment` concept exists. Considered during design and left out to avoid complicating a system real schools need to actually use.
- **Section-level analytics/reporting** — no per-section counts, dashboards, or breakdowns exist anywhere.
- **Sections do not affect promotion/rollover eligibility** — the Pending/Unresolved safeguard, the final-grade edge case, and every eligibility check in [Undecided students & next-session activation](#undecided-students--next-session-activation-) remain entirely grade-based, exactly as before sections existed.

## Deliberately out of scope

Per the original Phase 2 brief: certificates, MEGA Academy courses, Opportunities, and Notifications were not touched by this work.
