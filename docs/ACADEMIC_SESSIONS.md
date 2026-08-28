# Academic Sessions

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase.
> Part of "Phase 2: Academic Sessions & Grades" — see [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) for the promotion/rollover mechanics, and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles.

## What it is ✅

An `AcademicSession` represents one school year (or term) for a single school — the container everything else in Phase 2 is scoped to: which teachers are assigned to which grades, and which grade every student is placed in, are both per-session.

## Schema ✅

`AcademicSession` — `id, schoolId (FK), name, startDate, endDate, status (default "ACTIVE")`. Valid `status`: `ACTIVE | CLOSED`.

## The one-ACTIVE-session-per-school rule ✅

A school may have at most one `ACTIVE` session at a time. This is enforced **at the application level, not a database constraint** (SQLite can't express a partial unique index) — `POST /api/schools/[id]/academic-sessions` checks for an existing `ACTIVE` session before creating a new one, and if one exists it returns that session with `alreadyActive: true` (HTTP 200, not an error) rather than creating a second one. Verified live with a genuine two-tab race condition: both tabs submitted the create form before either refreshed, and only one session was ever created — the second request correctly folded into a no-op.

## Creating the first session ✅

Part of [Initial School Setup](GRADES_AND_PROMOTION.md#initial-school-setup--5-step-guided-flow-) — a School Admin creates the school's first `AcademicSession` as a prerequisite step before configuring grades. `POST /api/schools/[id]/academic-sessions`.

## Closing a session and opening the next — "rollover" ✅

`POST /api/schools/[id]/academic-sessions/rollover` (`/dashboard/sessions/new` in the UI) closes the current `ACTIVE` session and opens a new one, in one transaction:

1. The prior session's `status` is set to `CLOSED`.
2. A new session is created with `status: "ACTIVE"`.
3. Every student whose most recent decision was `COMPLETED` or `REPEATED` **with a real outcome grade recorded** is automatically placed into the new session at that grade (a direct `GradeHistory` creation, not a decision — see [PRODUCT_RULES.md](PRODUCT_RULES.md)).
4. Anyone still `ENROLLED` with no decision ever recorded is **left unplaced** and surfaces in the persistent Pending/Unresolved queue — see [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md#new-session-creation-and-the-pendingunresolved-safeguard-).

**Verified**: a full end-to-end run with 6 students in a mixed state (2 promoted, 1 repeated, 1 left, 2 undecided) produced exactly the right split at the database level, and a real 120-student timing run through the actual HTTP route completed in 365ms.

## Grade decisions happen independently of session status ✅

The Student Promotion workflow (per-grade rosters, see [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md)) has **no dependency on session status at all**, and no dependency on other grades being finished first. A School Admin can promote/repeat/transfer/leave students in Grade 6 today and not touch Grade 7 until next week — each grade's roster is handled independently, at whatever pace the school actually works at. The only thing that ever forces a session boundary is the School Admin explicitly choosing to start a new session via the rollover flow.

One added wrinkle, also implemented and tested: the Promotion roster page can target a **closed** session too (`/dashboard/grades/[schoolGradeId]?session=<id>`), reached only from the Pending/Unresolved queue's "Record decision →" link — this is how a School Admin resolves a student whose decision was never made before the session closed, without reopening the session itself.

## What's built vs. not

| Piece | Status |
|---|---|
| `AcademicSession` model | ✅ |
| One-ACTIVE-per-school rule (app-enforced) | ✅ verified with a real race condition |
| First-session creation (Initial Setup) | ✅ |
| Rollover (close prior, open new, auto-carry-forward) | ✅ verified at 6-student and 120-student scale |
| Pending/Unresolved queue, persistent across any number of rollovers | ✅ verified across a 3-session chain |
| Any UI to rename/edit/delete a past session | 🔭 not built — sessions are create-and-close only |
| Per-session reporting/analytics (e.g. how many students per grade over time) | 🔭 not built |

## Explicitly out of scope for Phase 2

Per the original design brief: certificates, MEGA Academy courses, Opportunities, and Notifications were untouched by this phase. A future grade-completion certificate (`issueGradeCertificate()`, see [CERTIFICATES.md](CERTIFICATES.md)) would eventually read from `GradeHistory`/`AcademicSession`, but that integration doesn't exist yet.
