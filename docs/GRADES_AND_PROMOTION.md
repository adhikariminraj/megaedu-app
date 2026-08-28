# Grades & Promotion

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase.
> See [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) for the session side, and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles (snapshot fields, never-guess matching, audited decisions).

## Why this exists ✅

`Student.gradeLevel` is a free-text field — schools historically typed "Grade 6", "Class 6", "VI", whatever they liked, with no structure and no history. Phase 2 replaces this with a structured, auditable model, while leaving `gradeLevel` in place permanently as a legacy fallback (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) — schools adopt the new structure on their own timeline, and nothing forces a breaking migration.

## Schema ✅

Six models total (`AcademicSession` has its own doc). Full field lists in [DATABASE.md](DATABASE.md).

- **`GradeReference`** — the platform-wide, fixed grade ladder. Seeded once: `PP1, PP2, PP3, Y1, Y2, ..., Y10` (13 rows, `order` 1–13). Not school-editable.
- **`SchoolGrade`** — a school's opt-in to one `GradeReference`, with its own `displayName` (e.g. `"Class 6"` for `Y6`).
- **`TeacherGradeAssignment`** — per-session teacher-to-grade link.
- **`GradeHistory`** — a student's grade placement for one session; the permanent record. Unique on `(studentId, academicSessionId)`.
- **`GradeHistoryAudit`** — append-only log of every decision ever written to a `GradeHistory` row.

## The audited write-path: `recordGradeDecision()` ✅

`src/lib/gradeHistory.ts` — the **only** code path anywhere in the app allowed to change a `GradeHistory` row's `status`/`outcomeGradeId`. In one transaction: reads the current state, writes the new state, inserts a `GradeHistoryAudit` row capturing both — including the very first decision ever made on a row, not just later corrections. Rejects an invalid status before writing anything.

**Verified**: a targeted test isolated exactly the "first decision" case — 0 audit rows before, 1 after, `previousStatus: "ENROLLED"`, `previousOutcomeGradeId: null` captured correctly.

## The legacy matching utility: `matchLegacyGradeText()` ✅

`src/lib/gradeMatching.ts` — matches free text (`"Grade 6"`, `"Class 6"`, `"VI"`, `"Nursery"`, `"UKG"`) to a `GradeReference` code. Handles the full Roman numeral range I–X including subtractive notation (`IV`→4, `IX`→9 — verified explicitly, not assumed), ordinal suffixes (`"6th Grade"`), and pre-primary keywords (`nursery`→`PP1`, `lkg`→`PP2`, `ukg`→`PP3`). **Returns `null` — never a guess — for anything ambiguous or out of range** (`"Grade 11"`, `"KG"` alone, `"Room 6B"`, spelled-out numbers): verified with over 20 real inputs including deliberately tricky ones.

## Initial School Setup — 5-step guided flow ✅

`/dashboard/setup`, gated by resolving the School Admin's own school (same access pattern as every other school-admin surface). Verified end-to-end live, with a real mix of matchable and unmatchable student records.

1. **Session** — create the school's first `AcademicSession` if none exists yet.
2. **Configure grades** — pick which `GradeReference`s the school uses, creating `SchoolGrade` rows. `POST /api/schools/[id]/grades`.
3. **Display names** — set each grade's label, defaulting to the code, editable. Same endpoint as step 2.
4. **Assign teachers** — bulk-pick teacher → grade(s) for the current session. `POST /api/schools/[id]/teacher-assignments`.
5. **Assign students** — runs `matchLegacyGradeText()` against every approved student's `gradeLevel`. Confident matches are pre-filled for one-click bulk confirmation; everything else goes into a manual queue with multi-select + bulk-assign. `POST /api/schools/[id]/grade-placements` — **a direct `GradeHistory` creation, `status: "ENROLLED"`, not routed through `recordGradeDecision()`**, since a first-time placement isn't a decision changing an existing row (see [PRODUCT_RULES.md](PRODUCT_RULES.md) for why this distinction matters).
6. **Review & confirm** — live counts (grades configured, teachers assigned, students placed, students still unmapped).

Verified with a real 5-student scenario: matching split 3 confident / 2 manual exactly as designed; database-level check confirmed all 5 resulting rows had `decidedAt: null` and produced **zero** `GradeHistoryAudit` rows, proving the direct-creation path was actually used.

## Student Promotion workflow — per grade, per session ✅

`/dashboard/grades/[schoolGradeId]` — a School Admin opens one `SchoolGrade`'s roster for the active session, sees every currently-`ENROLLED` student, multi-selects some, and applies one decision to the whole batch:

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

## Undecided students & next-session activation ✅

A student who is never decided stays `ENROLLED` in their current session's `GradeHistory` row indefinitely — nothing forces a decision. When the School Admin starts a new session (rollover), that student is **excluded from automatic placement** and appears in the persistent **Pending/Unresolved** queue on `/dashboard/grades`, which stays visible for as long as they remain unresolved — not just at the moment of rollover.

Two ways to resolve a pending student, both implemented:
1. **Record the missing decision** — the queue links directly to that student's grade roster, scoped to the closed session (`?session=<id>`), where the admin applies a real decision. This alone doesn't place them in the new session — a follow-up "Place eligible students now" action (or the next rollover) picks them up.
2. **Manually place them** — select the student directly in the queue, pick a grade, and place them into the current session immediately, skipping the old decision entirely. Their old row stays permanently `ENROLLED` with zero audit rows — a deliberate, honest gap in the record (the school chose not to record why), not an error.

**Verified across a 3-session chain** (a specific edge case worth calling out): a student left pending after session A→B remained correctly pending through B→C as well — even though they never had any row in session B at all — and `findPendingStudents()` still correctly traced back to their true last real placement in session A. Resolving them afterward placed them directly into session C, correctly skipping the empty session B.

## Repeated grades ✅

A repeat isn't an edit to the existing row — it's the `REPEATED` decision on the current session's row (with `outcomeGradeId` pointing at the *same* grade), and a **new** `GradeHistory` row gets created in the next session at that grade via the same carry-forward mechanism as a promotion. Nothing is overwritten; the history of "repeated Grade 6 in 2026, then completed it in 2027" is fully preserved across two separate rows.

## Audit records ✅

Every decision — promote, repeat, transfer, or leave — produces exactly one `GradeHistoryAudit` row, capturing `previousStatus`/`previousOutcomeGradeId` → `newStatus`/`newOutcomeGradeId`, who (`changedByUserId`) and when (`changedAt`). This table is genuinely append-only: no route anywhere updates or deletes a `GradeHistoryAudit` row. New placements (Initial Setup, rollover carry-forward, manual pending placement) are **not** audited, by design — see [PRODUCT_RULES.md](PRODUCT_RULES.md) for the reasoning.

## Deliberately out of scope

Per the original Phase 2 brief: certificates, MEGA Academy courses, Opportunities, and Notifications were not touched by this work.
