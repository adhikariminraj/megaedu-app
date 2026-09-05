# Institutional Context

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-05 (Phase 4, all sub-phases through 4D-4), against the current codebase.

## Why this exists ✅

[MEGA_ID.md](MEGA_ID.md) establishes that a MEGA ID belongs to the person, not to any school. This document covers what sits on top of that: how a person's relationship to a *specific* school is modeled, how it moves through its lifecycle, and — once a person can be related to more than one school at once — how the app decides which school's data to show them and enforces that they only ever act on a school they're actually genuinely related to.

## The three-layer model ✅

1. **`User`** (MEGA ID) — the account. Never school-scoped.
2. **`Teacher` / `Student`** — a stable role identity for that person. Still not school-scoped in the authoritative sense; it's the anchor a school relationship attaches to.
3. **`TeacherSchoolAffiliation` / `StudentSchoolAffiliation`** — the actual institutional relationship. A row per (person, school) pair, each independently carrying:
   - `status`: `PENDING` → `ACTIVE` → `ENDED`
   - `startDate` / `endDate` — real dates only, never fabricated or backfilled to make a display look tidier
   - a foreign key to the `Teacher`/`Student` and to the `School`

A person can hold **zero, one, or several** affiliation rows, in any mix of statuses, at the same time. Teacher-side multi-school (2+ simultaneous `ACTIVE` rows) is explicitly designed for and tested. Student-side simultaneous multi-school is schema-permitted but not yet a decided product policy — see [KNOWN_GAPS.md](KNOWN_GAPS.md).

## Lifecycle: JOIN / LEAVE / TRANSFER / REJOIN ✅

Implemented as primitives in `src/lib/affiliation.ts`, called from `src/app/api/teacher/{join-school,leave-school,transfer-school}/route.ts` and the equivalent `student/*` routes:

- **JOIN** — creates a new `PENDING` affiliation. Does not touch any existing affiliation the person already has elsewhere.
- **Approval** — a School Admin action (`POST /api/schools/[id]/{teachers,students}/[id]/approve`) flips a specific `PENDING` row to `ACTIVE`. Resolved via the affiliation table first; falls back to the legacy bridge-field check only when no affiliation row exists at all (very old data).
- **LEAVE** — ends the person's current `ACTIVE` affiliation at a school: `status → ENDED`, `endDate` set to now. Other affiliations (at other schools) are untouched.
- **TRANSFER** — ends the old affiliation and creates a new `PENDING` one at the destination school, as a single atomic operation. The affiliation primitives **throw** an `AffiliationError` on failure rather than returning `{ error }` — this matters because Prisma's `$transaction` only rolls back on a thrown error, never on a returned error value; an earlier version of TRANSFER returned errors and could leave a half-applied transfer (old ended, new never created) before this was caught and fixed.
- **REJOIN** — not a separate primitive; simply another JOIN call after a prior affiliation at that school has ended. The new row is independent of the old, ended one — history isn't merged or reopened.

## Bridge fields — transitional, not authoritative ✅

`Teacher.schoolId` / `Teacher.approved` / `Teacher.position` / `Teacher.subjects` and `Student.schoolId` / `Student.approved` still exist and are still read in a handful of legacy call sites not yet migrated (see [KNOWN_GAPS.md](KNOWN_GAPS.md)). They are kept in sync automatically **only** for the simple case of zero-or-one open (`PENDING`/`ACTIVE`) affiliation. The moment a person has two or more, the bridge fields are deliberately left exactly as they were — never guessed, never arbitrarily picked from one of the two — because there is no correct single answer to write into a single-value field once the real relationship is one-to-many. Any code path that still reads the bridge fields directly (rather than the affiliation table) is, by construction, blind to a person's second-and-later school relationships.

## From ACTIVE affiliation to authorized access ✅

`src/lib/institutionalContext.ts` (Phase 4D-1) is the resolution layer between "a person has some affiliations" and "a specific request is allowed to touch a specific school's data":

```ts
getAccessibleSchools(userId: string): Promise<{ schoolId: string; schoolName: string; role: "SCHOOL_ADMIN" | "TEACHER" }[]>
verifySchoolAccess(userId: string, schoolId: string): Promise<{ role: "SCHOOL_ADMIN" } | { role: "TEACHER"; teacherId: string } | null>
```

- **`getAccessibleSchools()`** lists only **ACTIVE** relationships — `SchoolAdmin` rows and ACTIVE `TeacherSchoolAffiliation` rows. `PENDING` is deliberately excluded: a pending JOIN request is not yet a real relationship, and showing it as a selectable/switchable school would let someone see or act on a school before any admin approved them there. This function is a display/routing input only — it decides what a chooser *offers*, never by itself what a request is *allowed to do*.
- **`verifySchoolAccess()`** is the actual security gate: re-checked fresh on every request (no caching), independent of anything the client sent. It returns `null` (fail closed) for `PENDING`, `ENDED`, or no relationship at all with that specific school — otherwise the resolved role, and a `teacherId` when the caller is a Teacher. It is what every school-scoped page should ultimately depend on for "is this person allowed here," the same role `requireSchoolAdmin()`/`resolveActiveTeacherId()` play for API routes (see [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)). Deliberately scoped to School Admin and Teacher only — Student is not included, since simultaneous multi-school policy for Student remains undecided (see [KNOWN_GAPS.md](KNOWN_GAPS.md)).

**CEO-directed design principle**: ACTIVE affiliations alone define what's selectable/accessible — never `PENDING`. And the institutional-context resolver is authoritative even in the single-school case: a person with exactly one ACTIVE affiliation still has their context *resolved* through `getAccessibleSchools()`, not defaulted to "the only school" via some other, older lookup — there is no separate "skip the resolver when there's only one school" code path.

## The preference cookie — never authoritative ✅

`mega_school_ctx` (`src/app/api/dashboard/school-context/route.ts`, `POST`) — `httpOnly`, `sameSite=lax`, 180-day expiry. Records which school a person last chose, purely so returning to a same-URL page doesn't force them to choose again every visit. It is a **preference hint only**: every read of it is followed by re-validating the school against that person's current `getAccessibleSchools()`/`verifySchoolAccess()` result — a stale cookie pointing at a school the person no longer has ACTIVE access to (left, transferred out, affiliation ended) is simply ignored, falling back to the chooser, never trusted as a grant.

## Three proven migration patterns ✅

A page or feature that needs "which school does this person mean" falls into one of three shapes, all now implemented at least once:

1. **URL-scoped** — `/dashboard/schools/[schoolId]/{attendance,evaluations,meetings}`. The school is a path segment; `verifySchoolAccess()` runs against it directly. Used for pages shared between Teacher and Admin roles, where a chooser (when 2+ schools) routes into a fresh URL per school. Established in Phase 4D-1 (Attendance), reused unchanged in 4D-2 (Evaluations) and 4D-3 (Meetings).
2. **Same-URL** — `/dashboard/grades`. The page's URL never changes; `SchoolChooser` (passed a `redirectTo` prop) returns the person to that same URL after choosing, and the choice is then resolved via the just-set `mega_school_ctx` cookie (freshly re-verified, never trusted blindly). Used for Admin-only pages where introducing a new URL per school isn't worth it. Established in Phase 4D-4 (Grades index).
3. **Target-derived** — `/dashboard/academics/[gradeSubjectId]`, `/dashboard/grades/[schoolGradeId]`. No chooser at all: the URL parameter itself unambiguously belongs to exactly one school (a `GradeSubject`/`SchoolGrade` row has exactly one `schoolId`), so the school is derived directly from the target entity, then admin access to that *specific* school is checked with an exact `schoolAdmin.findUnique({ userId_schoolId })` — never an arbitrary `findFirst()` that could reject a genuinely-authorized multi-school Admin just because their first-found school row doesn't happen to be this one. The Grades companion page (`grades/[schoolGradeId]`) was fixed to this pattern in Phase 4D-4, matching the precedent `academics/[gradeSubjectId]` had already set.

## Scoped client-side navigation — the `basePath` pattern ✅

`AttendanceClient.tsx`, `EvaluationsClient.tsx`, and `MeetingsClient.tsx` each perform their own in-page filter navigation (`router.push(...)`) when a user changes a filter — a session, a grade, a date. Before Phase 4D-3, all three hardcoded this to their unscoped legacy path (e.g. `/dashboard/attendance?...`), which meant a person viewing the URL-scoped `/dashboard/schools/[schoolId]/attendance` page would be silently bounced back to the unscoped page on the very first filter change. Fixed by adding an optional `basePath` prop to all three components — when passed (by the URL-scoped page), internal navigation stays under `/dashboard/schools/[schoolId]/...`; when omitted, the original unscoped behavior is preserved exactly, so the legacy unscoped pages needed no changes at all.

## What's still on the legacy pattern 🔭

See [KNOWN_GAPS.md](KNOWN_GAPS.md) for the full, current list — in short: Initial Setup, New Session, Assessment Frameworks, Assessment Results, and the profile pages still resolve school context via a plain `findFirst()` pick rather than one of the three patterns above. This is in-progress migration debt, not a security gap — every write route independently re-checks ownership of the specific resource being changed regardless of which school the page happened to display.
