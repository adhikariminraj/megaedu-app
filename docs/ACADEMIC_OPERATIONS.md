# School Academic Operations (Phase 3B)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29 (Phase 3B, plus the Parent Academic Visibility follow-up), against the current codebase.
> Part of **Phase 3 — School Academic System**. This document covers Phase 3B and its direct follow-ups only. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) (Phase 3A — Subjects & Teacher Academic Assignment), [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md), [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md), and [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Why this exists ✅

Phase 3A gave a school a Subject catalog and fine-grained Teacher Academic Assignments, but no daily operational layer — no way to record who's actually responsible for a class day to day, whether a student showed up, how far a teacher has gotten through a subject's curriculum, or how a student did on a test. Phase 3B adds exactly those four pieces, all built on the same School → Session → Grade → Section → Subject coordinate system Phase 2/3A already established — nothing here duplicates `AcademicSession`, `GradeHistory`, `SchoolGrade`, `Section`, `Subject`, `GradeSubject`, or `TeacherAcademicAssignment`.

## Schema ✅

Seven new models, no changes to any existing model's columns — only new relation-array fields on `Teacher`, `Student`, `AcademicSession`, `SchoolGrade`, `Section`, `Subject`, `GradeSubject`, and `User`. Full field lists in [DATABASE.md](DATABASE.md).

- **`ClassTeacherAssignment`** — a designated Grade Class Teacher or Section Teacher for one grade/section, one session.
- **`Attendance`** — one row per student per calendar day.
- **`AttendanceAudit`** — append-only correction log for `Attendance`.
- **`TeachingPlan`** — a teacher's declared planned-total and display-label (Unit/Chapter) for one subject/grade/section/session.
- **`TeachingUnit`** — one curriculum unit/chapter, with a teaching-progress status.
- **`UnitTest`** — a test tied to one `TeachingUnit`.
- **`UnitTestResult`** — one student's evaluation for one `UnitTest`.

## A correction to `requireTeacherAssignment()`, made before Phase 3B depended on it ✅

Before building anything on top of it, Phase 3B re-examined `requireTeacherAssignment()`'s section-matching logic (built in Phase 3A, never called by any route until now) and found a real semantic gap: the original code treated `scope.sectionId: null` and `scope.sectionId: undefined` (omitted) identically, since both are falsy in JavaScript — collapsing "this target is grade-wide, require a grade-wide assignment" into "no section restriction, match anything." That would have wrongly let a section-specific-only teacher pass a check meant to require grade-wide access — exactly the situation a grade-wide `TeachingUnit` (`sectionId: null`) creates.

**Fix**: a shared `sectionScopeWhere()` helper now distinguishes three cases — omitted (broad match, any section), `null` (require a grade-wide assignment specifically), and a real section id (grade-wide OR that exact section). Both `requireTeacherAssignment()` and the new `requireClassTeacher()` use it. Since nothing called `requireTeacherAssignment()` before Phase 3B, this was a correction made ahead of its first real use, not a behavior change to anything already running.

**Verified independently before any Phase 3B feature was built on it**: six scenarios against real `TeacherAcademicAssignment` data (a grade-wide and a section-specific-only teacher, checked against `undefined`/`null`/matching-section/non-matching-section targets) all returned the intentional result — critically, `sectionSpecific_null_expectFalse` confirmed a section-specific-only teacher is correctly rejected when a grade-wide assignment is required. The same six-scenario shape was re-verified for `requireClassTeacher()` against real `ClassTeacherAssignment` data, and — separately — proven live through the real HTTP `attendance` route: a Section Teacher account received `403 Forbidden` both when targeting another section and when targeting the whole grade unscoped.

## 3B-1: Class/Section Teacher Assignment ✅

`ClassTeacherAssignment` — a Grade Class Teacher (`sectionId: null`, authority across every section in that grade) or a Section Teacher (`sectionId` set, authority over only that section). Session-scoped, never carried forward (same pattern as `TeacherGradeAssignment`/`TeacherAcademicAssignment`). Not audited, real `DELETE` route.

**Unlike `TeacherAcademicAssignment`, there is no overlap-blocking rule** — a grade-wide Class Teacher and per-section Section Teachers may coexist for the same grade (e.g. Class 6 → a Grade Class Teacher, while Class 6A and Class 6B each have their own Section Teacher), per explicit approval. Uniqueness is on the *slot*: `@@unique([schoolGradeId, sectionId, academicSessionId])` means at most one Class/Section Teacher per grade-or-section, per session — a request for an already-filled slot is silently skipped.

**A real bug was found and fixed during live verification**: the `@@unique` constraint reliably catches a duplicate *section-specific* slot (a real `sectionId` value), but — the same `NULL ≠ NULL` unique-index behavior documented elsewhere in this schema — did **not** catch a second *grade-wide* (`sectionId: null`) row for the same grade/session. A live test confirmed this: a duplicate grade-wide assignment was wrongly accepted (`created: 1` when it should have been `skipped: 1`). Fixed by adding an explicit app-level pre-check for the grade-wide case inside the same transaction (so it also sees a grade-wide row created earlier in the same batch), mirroring the existing pattern already used for `TeacherAcademicAssignment`'s own overlap rule. Re-verified afterward in both a single request and an in-batch (two grade-wide requests in one submission) scenario — both now correctly reject the duplicate.

Routes: `POST/DELETE /api/schools/[id]/class-teacher-assignments...`, gated by `requireSchoolAdmin`.

## 3B-2: Daily Student Attendance ✅

`Attendance` — one row per student per calendar day, never subject-based. `@@unique([studentId, date])` is global, not per-session, matching the literal "one status per school day" requirement.

**Date handling**: the client always sends an explicit `"YYYY-MM-DD"` string (from a date picker, defaulting to the browser's local today — never server-computed); the server converts it via `new Date(dateString)`, the exact convention already used for `AcademicSession.startDate`/`endDate`, which JS parses as UTC midnight for a date-only ISO string. The server never calls `new Date()` for "today" itself, avoiding any assumption about which timezone the server happens to run in versus the school's actual local day.

**Corrections are audited, including remarks**: `correctAttendance()` (`src/lib/attendance.ts`, same shape as `reassignSection()`) updates `status`/`remarks` and inserts one `AttendanceAudit` row — capturing `previousStatus`/`newStatus`/`previousRemarks`/`newRemarks` together, every time, even when only one of the two actually changed (the unchanged field is echoed, same "full snapshot every time" pattern as `GradeHistoryAudit`). Verified live: a status-only correction, then a remarks-only correction on the same row, produced two audit rows each preserving the full before/after state.

**Who can mark/correct attendance**: `requireSchoolAdmin` OR `requireClassTeacher(schoolId, {academicSessionId, schoolGradeId, sectionId})` — a Grade Class Teacher may mark the whole grade in one pass or drill into one section; a Section Teacher may only mark their own section, and can never submit a whole-grade-unscoped pass. **Verified live through a real logged-in Section Teacher account**: marking their own section succeeded; marking a different section returned `403`; marking the whole grade unscoped also returned `403` (this is the concrete case the `requireTeacherAssignment()`/`requireClassTeacher()` semantics fix above exists for).

**Roster integrity**: each record's actual `schoolGradeId`/`sectionId` snapshot on the `Attendance` row is taken from the student's own current `GradeHistory` placement, never blindly from client input — a student whose placement doesn't match the marking pass's target grade/section is silently skipped, never recorded against the wrong class. Duplicate marking (same student, same day) is idempotent — silently skipped, not an error.

Routes: `POST /api/schools/[id]/attendance` (bulk mark), `PATCH /api/schools/[id]/attendance/[attendanceId]` (correction).

## 3B-3: Teaching Plans and Units/Chapters ✅

`TeachingUnit` — one curriculum unit/chapter under a `GradeSubject`, with `title` (school/teacher's own wording — nothing forces "Unit" or "Chapter"), an app-assigned `order` (current count in its scope + 1 — not a DB unique constraint, the same `NULL`-in-unique-index reasoning as elsewhere), and a `status`: `NOT_STARTED | IN_PROGRESS | COMPLETED`. Moving to `IN_PROGRESS` sets `startedAt` if not already set; moving to `COMPLETED` sets `completedAt` (backfilling `startedAt` if skipped directly from `NOT_STARTED`); moving back to `NOT_STARTED` or `IN_PROGRESS` from `COMPLETED` clears `completedAt`, since it reflects only the most recent completion, not a log. Verified live through the full lifecycle including the revert-clears-completedAt case.

**`sectionId` null = grade-wide unit sequence** (shared by every section); a real value = that section's own, independent sequence — a school can mix both depending on whether its sections pace together.

`TeachingPlan` — the requested "planned total" context, deliberately a **separate model from `TeachingUnit`** (not a field bolted onto every unit row): `plannedTotal` (the teacher's declared target — e.g. "12 chapters planned" — independent of how many `TeachingUnit` rows currently exist) and `unitLabel` (free text, e.g. `"Unit"` or `"Chapter"`, satisfying "support either terminology... without requiring separate underlying database models" as a plain string field, not a second model). Optional — no row means no plan is set, and progress views fall back to raw counts with no percentage-of-plan. Write path is find-or-update-else-create (not a bare insert), the same reasoning as `GradeSubject`'s section-null uniqueness caveat.

Both are gated by `requireTeacherAssignment()`, scoped to the exact `(academicSessionId, schoolGradeId, sectionId, subjectId)` the unit or plan belongs to — this is precisely the primitive built in Phase 3A for this purpose, corrected above before its first use.

Routes: `POST /api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/teaching-plan`, `POST /api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/units`, `PATCH /api/schools/[id]/units/[unitId]`.

## 3B-4: Unit/Chapter Tests and Student Evaluation ✅

`UnitTest` — belongs to one `TeachingUnit`; multiple tests per unit are allowed (e.g. a quiz and a chapter test), no uniqueness constraint blocks it. **Creatable only once its unit is `IN_PROGRESS` or `COMPLETED`** — a route-level rule, verified live (a `NOT_STARTED` unit's test-creation attempt returned `400` with a clear message; the same unit accepted a test once moved to `IN_PROGRESS`).

`UnitTestResult` — **pre-created for every student currently enrolled in the test's scope** (via `GradeHistory`, matching the unit's own `schoolGradeId` and, if set, `sectionId`) at test-creation time, `status: "PENDING"` — a stable roster snapshot, not something inferred later by diffing against a roster that could change. Status: `PENDING | EVALUATED | ABSENT`. Setting `ABSENT` forces `marksObtained` to `null` regardless of what's passed; setting `EVALUATED` requires a real `marksObtained` between `0` and the test's `maxMarks` (out-of-range values are rejected, verified live). No retest concept.

**Authorization is scoped to the unit's own section** — a section-specific teacher can only evaluate students in their own section's test, verified via the same `requireTeacherAssignment()` scope resolution used throughout Phase 3B.

Routes: `POST /api/schools/[id]/units/[unitId]/tests` (creates the test + pre-creates results), `PATCH /api/schools/[id]/tests/[unitTestId]/results` (bulk evaluate).

## Read-side UI ✅

- **School Admin** — `/dashboard/attendance` (mark/correct attendance for any grade/section/date) and an extended `/dashboard/academics`: a "Class & Section Teachers" panel per grade, and each offered subject now links to `/dashboard/academics/[gradeSubjectId]` — a section-tabbed page showing the Teaching Plan, Units/Chapters with progress controls, and per-unit Tests with roster evaluation.
- **Teacher** — the same `/dashboard/academics/[gradeSubjectId]` page (read-only outside their own authorized scope — enforced server-side by the same routes, not just hidden in the UI) and `/dashboard/attendance` (scoped to only the grades/sections their `ClassTeacherAssignment`s actually cover). The Teacher dashboard gained two new linked sections: "Your Class & Section Teacher Responsibilities" (→ Take attendance) and an extended "Your Academic Assignments" (→ Manage teaching).
- **Student** — three new read-only dashboard sections: Teaching Progress (per subject: completed/in-progress/total), Test Results (per test: marks, status, remarks), and Recent Attendance (last 15 days, reflecting corrections — verified live that a corrected status/remarks pair displays, not the original).
- **Parent** ✅ (added as a standalone follow-up after Phase 3B shipped, not part of the original Phase 3B brief — Phase 3B itself deliberately deferred this) — the same three sections, once per linked child, on the existing Parent dashboard. See "Parent Academic Visibility" below.

## Parent Academic Visibility ✅ (added after Phase 3B)

Phase 3B's own brief explicitly deferred parent-facing work ("Do not build unrelated parent features unless the existing Parent architecture already makes this straightforward"). Once Phase 3B shipped, an investigation confirmed the `Parent` → `ParentStudent` → `Student` relationship already supported everything needed — no schema gap, purely a missing read-side query. This was then built as a small, additive follow-up:

- **`fetchAcademicProgress(studentId)`**, a single shared query function in `dashboard/page.tsx` (recent `Attendance`, active-session `GradeHistory` → `GradeSubject`/`TeachingUnit` progress, recent `UnitTestResult`s) — the exact same three-query shape the Student branch already used, extracted so both branches call the identical logic rather than maintaining two copies.
- **`AcademicProgressPanel`**, a shared presentational component (`src/components/AcademicProgressPanel.tsx`) holding the Teaching Progress / Test Results / Recent Attendance markup, extracted from `StudentDashboard.tsx` with no behavioral change (verified live: a Student's own dashboard renders identically before and after) and reused, once per linked child, inside each child's own card on `ParentDashboard.tsx`.
- **Strict per-child isolation**: the Parent branch resolves `parent.children` from the logged-in user's own session first, then calls `fetchAcademicProgress()` once per child using only that server-derived `studentId` — never a client-supplied one. There is no new API route (this stays a server-component-rendered page, consistent with every other dashboard branch), so there's no request parameter surface to spoof in the first place. Verified live: one parent linked to two children (one with genuine pre-existing data, one freshly created with deliberately distinct attendance/progress/test data) — both children's cards showed only their own information, no mixing; a third, unrelated student never appeared anywhere on the page.
- A parent with no linked children, or a child not yet approved by their school, renders exactly as before — the panel simply shows no extra sections when there's nothing to show (same graceful-empty behavior already used for the Student's own dashboard).

## Deliberately out of scope

Per the explicit Phase 3B brief: homework/assignments and completion tracking, examinations beyond Unit/Chapter Tests, report cards, analytics, AI features, fees/accounting, messaging, and timetable/scheduling are all untouched — reserved for later phases, to be designed separately. No teaching hierarchy (primary/assistant/substitute) exists for Class/Section Teachers, matching the same decision already made for `TeacherAcademicAssignment` in Phase 3A. (Parent-facing academic visibility, originally deferred here too, was subsequently built as the standalone follow-up described above.)
