# Assessment & Evaluation — Teacher Qualitative Evaluation and Parent-Teacher Meetings (Phase 3C)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30, against the current codebase.
> Part of **Phase 3 — School Academic System**. This document covers Phase 3C — Teacher Qualitative Evaluation and Parent-Teacher Meetings, including the Phase 3C-2 completion slice (reschedule, subject-specific meeting UI, cross-role Meetings management, and the Student Profile page). See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) (Phase 3A), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md) (Phase 3B), and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles this phase reuses.

## Why this exists ✅

Phase 3B gave a school Unit/Chapter Tests (numeric marks against one curriculum unit) but nothing for a teacher's broader, narrative judgment about a student, and nothing for scheduling a conversation between a teacher and a parent. Phase 3C adds exactly those two pieces, reusing the same School → Session → Grade → Section → Subject coordinate system, the same roster-from-`GradeHistory` pattern, and the same School-Admin/Teacher authorization composition already established — no `Event` model reuse (it's a school-wide broadcast model with no per-student audience, deliberately not extended for this) and no new permission helper (`requireTeacherAssignment`/`requireClassTeacher` already cover every case).

## Schema ✅

Two new models, additive only — no existing model's columns changed, only new relation-array fields on `School`, `Teacher`, `Student`, `AcademicSession`, `SchoolGrade`, `Section`, `GradeSubject`, and `User`. Full field lists in [DATABASE.md](DATABASE.md).

- **`StudentEvaluation`** — a teacher's narrative, qualitative remark about one student, for one session. `gradeSubjectId` optional: `null` = General Student Evaluation (Grade Class Teacher / Section Teacher); set = Subject Evaluation (Subject Teacher). **This is the only place the General-vs-Subject distinction is recorded — there is no separate `type` field; the UI derives its label entirely from whether `gradeSubjectId` is set.**
- **`StudentEvaluationAudit`** — append-only correction log, written only once an evaluation has been shared with a Parent and/or a Student (see below).
- **`ParentTeacherMeeting`** — a scheduled meeting between one `Teacher` and one `Student`'s parent(s), with `status: SCHEDULED | COMPLETED | CANCELLED`, `outcomeNotes`, and an optional `linkedEvaluationId` referencing a `StudentEvaluation`.

## `StudentEvaluation` — General vs. Subject, from one model ✅

`gradeSubjectId: null` and `gradeSubjectId: <id>` are not two different features — they're the same model, the same routes, the same audit mechanism, distinguished purely by that one nullable field, mirroring how `TeachingUnit.sectionId: null` already means "grade-wide" elsewhere in this schema. Two authoring paths:

- **Subject Evaluation** — a Subject Teacher, authorized via `requireTeacherAssignment(schoolId, {academicSessionId, schoolGradeId, sectionId, subjectId})`. Lives on `/dashboard/academics/[gradeSubjectId]`, in a new "Subject Evaluations" panel alongside Teaching Plan/Units/Tests — the same page Subject Teachers already use, not a new surface.
- **General Student Evaluation** — a Grade Class Teacher or Section Teacher, authorized via `requireClassTeacher(schoolId, {academicSessionId, schoolGradeId, sectionId})`. Lives on a new page, `/dashboard/evaluations`, mirroring `/dashboard/attendance`'s existing grade/section picker pattern exactly (same `GradeOption` shape, same roster-from-`GradeHistory` resolution).

**A School Admin may create either on behalf of a named teacher** (`teacherId` in the request body), matching the School-Admin/Teacher parity already established for every other Phase 3 write route (attendance, teaching plans, units, tests). The admin-specified `teacherId` is independently validated — `teacherHoldsSubjectAssignment()`/`teacherHoldsClassAssignment()` (new exported helpers in `src/lib/authorize.ts`, alongside the now-exported `sectionScopeWhere()`) check that the *named* teacher, not the session's own user, actually holds a matching assignment. A teacher acting on their own behalf has `teacherId` resolved from their own session; any `teacherId` they pass in the body is ignored unless it matches their own.

**Duplicate protection, handled explicitly at the application level**: `@@unique([studentId, teacherId, academicSessionId, gradeSubjectId])` reliably catches an exact duplicate *subject-specific* slot, but — the same `NULL ≠ NULL` unique-index gap already found and fixed twice elsewhere in this schema (`TeacherAcademicAssignment`, `ClassTeacherAssignment`) — does **not** by itself catch a second *general* (`gradeSubjectId: null`) evaluation from the same teacher/student/session. `POST /api/schools/[id]/students/[studentId]/evaluations` pre-checks this case explicitly before creating, from the start (not discovered via a live bug this time). **Verified live**: a second general-evaluation attempt for the same teacher/student/session returned `409` with a clear message.

## The audit-on-share mechanism ✅

`updateEvaluationRemarks()` (`src/lib/evaluation.ts`) is the only code path allowed to change an existing `StudentEvaluation`'s `remarks`:

- While the evaluation is still fully private (`visibleToParent` **and** `visibleToStudent` both `false`) — a plain update, no audit row. Freely editable, matching the "creation/drafting isn't a decision" reasoning already used for `TeachingPlan`/`TeachingUnit`.
- **Once shared with EITHER audience** — every subsequent edit instead updates the row **and** inserts a `StudentEvaluationAudit` row (`previousRemarks`/`newRemarks`) in the same transaction, so previously shared information can never be silently rewritten.

This reads "shared with either audience," not "shared with a parent specifically" — an evaluation shared with a Student only gets the identical integrity guarantee as one shared with a Parent, since both are equally "no longer just the author's private draft." (Explicitly confirmed with the requester as the intended generalization of "once shared with a parent" — see the design-approval conversation this doc reflects.)

`shareEvaluation()` (same file) flips `visibleToParent` or `visibleToStudent` to `true` and stamps the matching `sharedWithParentAt`/`sharedWithStudentAt` timestamp — **a one-way action in this phase, no un-share path**, the same "permanent once released" precedent as `Certificate` issuance elsewhere in this schema. Idempotent: sharing an already-shared audience again is a no-op.

**Verified live, exactly this sequence**: created an evaluation (0 audits, both flags `false`) → edited it while still private (0 audits after) → shared with Parent (`visibleToParent: true`, `sharedWithParentAt` set) → edited again (**exactly 1** audit row, correct `previousRemarks`/`newRemarks`) → shared with Student too (`visibleToStudent: true`, `sharedWithStudentAt` set independently, timestamps distinct) — both flags now `true` independently, no cross-effect between the two share actions.

## Parent and Student visibility — deliberately separate gates ✅

`visibleToParent` and `visibleToStudent` are two fully independent booleans — sharing with one audience never implies or affects the other. **Verified live with two evaluations for the same student**: a General Evaluation shared with both Parent and Student appeared on both the Student's own dashboard and the Parent's dashboard (for that linked child); a Subject Evaluation shared with **Student only** appeared on the Student's dashboard but was **confirmed absent** from the Parent's dashboard for the same child — proving the two gates don't leak into each other.

Both `fetchAcademicProgress(studentId, audience)` (now `src/lib/academicProgress.ts` — relocated out of `dashboard/page.tsx` in Phase 3C-2 so `/dashboard/students/[studentId]` could reuse it too, no logic changed) and `AcademicProgressPanel.tsx` (`src/components/AcademicProgressPanel.tsx`) were extended with this in mind: the function takes an explicit `audience: "STUDENT" | "PARENT" | "STAFF"` parameter and filters `StudentEvaluation` rows on the matching boolean — the Student branch always calls it with `"STUDENT"`, the Parent branch always with `"PARENT"`, the Student Profile page (School Admin/Teacher) with `"STAFF"` (see below), per child, never shared or reused between the three.

### The `"STAFF"` audience — unfiltered, staff-only visibility ✅

Added in Phase 3C-2 for the new Student Profile page (`/dashboard/students/[studentId]`, see below). `audience: "STAFF"` skips the `visibleToParent`/`visibleToStudent` filter entirely — every `StudentEvaluation` for the student is returned, including ones never shared with anyone. This is intentional: School Admins and approved Teachers already have full write access to evaluations at their school, so seeing genuinely private ones on a staff-only profile page introduces no new exposure. **Verified live**: a general evaluation with both `visibleToParent: false` and `visibleToStudent: false` appeared correctly on the Student Profile page for a School Admin, and was independently confirmed absent from that same student's own dashboard (`"STUDENT"` audience) and would be absent from the Parent dashboard (`"PARENT"` audience) — the three audiences never cross-contaminate.

## Parent-Teacher Meetings — periodic and occasional, one model ✅

`ParentTeacherMeeting` handles both cases through the identical model and the identical route — the only difference is cardinality, not mechanism:

- **Occasional** (a single meeting) and **periodic** (e.g. a PTM week for a whole grade) both go through `POST /api/schools/[id]/meetings`, body `{meetings: [...]}` — one item for occasional, many for periodic. No separate "recurring series" concept was built; nothing in the approved design asked for recurrence rules, and adding one would have been unnecessary complexity for a need this route already satisfies by letting the caller submit as many items as they want in one request.
- **Every item is resolved and validated before the transaction opens** — the Postgres-safe pattern already used by `grade-decisions`/the rollover sweep, not the SQLite-only catch-mid-transaction pattern used by `grade-placements`/`teacher-assignments` (see [KNOWN_GAPS.md](KNOWN_GAPS.md) for that documented risk) — so this route doesn't add a third instance of it.
- **Initiation**: School Admin or an authorized Teacher only (`requireTeacherAssignment`/`requireClassTeacher`-validated per item, resolved from each item's actual student placement, never trusted from client-sent scope). **Parents have no write path at all** in this phase — read-only recipients. A parent-initiated meeting request was explicitly out of scope for this phase (may be considered later).
- **Editing an existing meeting** (`PATCH /api/schools/[id]/meetings/[meetingId]` — status, `outcomeNotes`, `linkedEvaluationId`, and, since Phase 3C-2, `scheduledAt`/`location`/`onlineUrl` for rescheduling) is authorized by identity rather than re-derived scope: a School Admin, or specifically the teacher the meeting's own `teacherId` names, and that teacher must still be `approved: true` at the meeting's school. Since the row already captures a committed relationship, there's no need to re-verify the teacher still holds a matching *academic* assignment the way *creation* does.
- **Rescheduling** (Phase 3C-2): any of `scheduledAt`/`location`/`onlineUrl` present in the body triggers reschedule handling — the meeting must still be `SCHEDULED` (a `COMPLETED`/`CANCELLED` meeting's original details are historical record, not editable; attempting it returns `400`). Not audited — same non-audited precedent as `outcomeNotes` below, only `StudentEvaluation.remarks` has that requirement in this phase.

**Verified live**: a School Admin bulk-scheduled 2 meetings in one request (`created: 2, skipped: 0`) on behalf of a named teacher; a teacher without a matching assignment attempting to schedule "as" a different, named teacher was rejected (`skipped`, nothing created); a Subject Teacher successfully self-scheduled a subject-specific meeting for their own scope; marking a meeting `COMPLETED` with `outcomeNotes` and a `linkedEvaluationId` persisted all three fields correctly (confirmed via a direct API round-trip); cancelling a different meeting set `status: CANCELLED` correctly. **Phase 3C-2 additions, also verified live**: the meeting's own teacher successfully rescheduled a `SCHEDULED` meeting (`scheduledAt`/`location` both updated, `200`); the same reschedule attempted against a `COMPLETED` meeting was rejected (`400`, "Only a still-scheduled meeting can be rescheduled."); an unapproved teacher (`approved: false`) attempting to modify their own meeting was rejected (`403`); a teacher attempting to modify a meeting belonging to a *different* teacher at the same school was rejected (`403`).

## Linking an evaluation to a meeting ✅

`ParentTeacherMeeting.linkedEvaluationId` is a plain (non-unique) FK to `StudentEvaluation` — many meetings may reference the same evaluation (e.g. a follow-up meeting revisiting the same prepared note), validated at write time to belong to the same student as the meeting. Wired into the UI as an evaluation picker shown when marking a meeting `COMPLETED` on `/dashboard/evaluations` — a teacher can attach a prepared evaluation as context for the outcome being recorded. **Verified live**: linking a real evaluation to a meeting on completion round-tripped correctly through the API and was visible on the resulting `meeting.linkedEvaluationId`.

## Parent-Teacher Meetings are Parent/Staff-visible only — Students never see them ✅

`fetchMeetingsForStudent(studentId, audience)` (`src/lib/academicProgress.ts`, renamed from `fetchParentMeetings` and relocated in Phase 3C-2 alongside `fetchAcademicProgress`) takes `audience: "PARENT" | "STAFF"` — note the type itself has no `"STUDENT"` member, so a Student-audience call is a compile error, not just an unused code path. It is called from the PARENT branch of `dashboard/page.tsx` (`"PARENT"`) and from the Student Profile page (`"STAFF"`) — **never** from the STUDENT branch, and never folded into `fetchAcademicProgress()` or `AcademicProgressPanel.tsx` (the one component shared with the Student's own render path). This is a structural guarantee, not a hidden UI section: there is no code path in the Student's own page render where `ParentTeacherMeeting` is ever queried, so there's no query result that could accidentally leak into the Student's view even if a future edit to `AcademicProgressPanel.tsx` were careless about it.

**Verified live**: a Student whose General Evaluation and meetings both existed and were fully populated saw Teacher Evaluations (both shared ones) but **no Parent-Teacher Meetings section anywhere on their dashboard** — confirmed by direct page-text inspection, not just visual absence. Re-verified after the Phase 3C-2 relocation/rename of the shared query functions, and again with direct navigation attempts: a Student hitting `/dashboard/students/[studentId]` (the new Student Profile page, which does render meetings) or `/dashboard/meetings` (the new Meetings management page) directly by URL is redirected away before any meeting data is fetched, in both cases.

## Read-side UI ✅

- **School Admin** — `/dashboard/evaluations` (General Evaluations, any grade/section) and the "Subject Evaluations" panel on `/dashboard/academics/[gradeSubjectId]` (any subject/section); both now carry meeting scheduling and management UI (a shared `MeetingActions` component, see below). Also `/dashboard/meetings` — every meeting at the school, filterable by teacher/status/upcoming-past — and `/dashboard/students/[studentId]`, a full read profile for any approved student at the school.
- **Teacher** — the same surfaces, scoped to their own `ClassTeacherAssignment`/`TeacherAcademicAssignment`s; `TeacherDashboard.tsx`'s existing "Your Class & Section Teacher Responsibilities" section carries the "General evaluation →" link, and a separate "Your Parent-Teacher Meetings →" link opens `/dashboard/meetings` scoped to just their own meetings. `/dashboard/students/[studentId]` is also available to any approved Teacher at the student's school (see the Student Profile section below).
- **Student** — a new "Teacher Evaluations" block in `AcademicProgressPanel.tsx`, showing only `visibleToStudent: true` rows, each labeled "General Evaluation" or the subject's name. No meetings visibility anywhere (see above).
- **Parent** — the same block (via the shared panel, `visibleToParent`-filtered) plus a "Parent-Teacher Meetings" section on `ParentDashboard.tsx` per linked child (deliberately **not** part of the shared `AcademicProgressPanel`, so there is no shared component a Student's render path could ever pull meeting data through) — including, since Phase 3C-2, the linked evaluation's remarks (`linkedEvaluationRemarks`) when a completed meeting references an evaluation that is itself `visibleToParent: true`; if the linked evaluation isn't shared with that parent, the remarks are omitted, not partially shown.

## Reusable meeting actions — one component, three surfaces ✅

Phase 3C-2 extracted all meeting create/complete/cancel/reschedule/link logic into a single shared component, `src/components/MeetingActions.tsx`, replacing what had been duplicated inline state in `EvaluationsClient.tsx`. It's used identically in three places:

- `/dashboard/evaluations` (General Evaluations) — grouped per student, `allowCreate=true`.
- `/dashboard/academics/[gradeSubjectId]` (Subject Evaluations panel) — same component, scoped by `gradeSubjectId`, closing the "no self-serve subject meeting UI" gap called out in the original Phase 3C-1 design.
- `/dashboard/meetings` (Meetings management) — one meeting per row (`allowCreate=false`, `showStudentName=true`), not grouped by student.

The reschedule form only renders for a meeting's own teacher (or an Admin) while it's still `SCHEDULED`, matching the API's own enforcement — the UI never offers an action the backend would reject.

## Meetings management — `/dashboard/meetings` ✅

A single, role-aware server component (`src/app/dashboard/meetings/page.tsx` + `MeetingsClient.tsx`) replacing the need for any separate admin-only or teacher-only meetings screen:

- **Teachers** see and manage only their own meetings — the query is unconditionally scoped to `teacherId: myTeacherId` server-side; a `?teacher=<other-id>` query param is structurally ignored for non-admins (verified live: passing another teacher's id changed nothing about the results shown).
- **School Admins** see every meeting at the school, with a teacher-picker plus status (`SCHEDULED`/`COMPLETED`/`CANCELLED`) and upcoming/past (`scheduledAt` vs. now) filters, all applied at the query level, not client-side.
- Every row renders through the shared `MeetingActions` component (above), so management here has identical capabilities to managing a meeting from the Evaluations/Academics pages.

**Verified live**: status filter (`?status=CANCELLED`) correctly narrowed results to only cancelled meetings; `?when=past` correctly returned zero results for meetings all scheduled in the future, while `?when=upcoming` returned them; a non-admin teacher's `?teacher=` override attempt had no effect on the result set.

## Student Profile — `/dashboard/students/[studentId]` ✅

A new, staff-only read page reusing every existing Phase 3B/3C data source — no new models, no new queries beyond the `"STAFF"` audience addition described above. Shows: Skills & Competencies, Teacher Evaluations (via `fetchAcademicProgress(id, "STAFF")` — unfiltered, sees private evaluations too), Attendance, Teaching Progress, Unit Test results, and Parent-Teacher Meetings (via `fetchMeetingsForStudent(id, "STAFF")`), rendered locally on the page rather than through the shared `AcademicProgressPanel` (same reasoning as the Parent dashboard's meeting section — keeps the Student-safe shared component free of any meeting-fetching code path).

**Access rule** (explicitly confirmed as the intended Phase 3C staff-visibility rule, matching the existing Skills-page precedent — no assignment-level restriction introduced): any School Admin of the student's school, or any `approved: true` Teacher of that school, may view the page — not scoped to only teachers with a matching academic/class assignment for that specific student. `DashboardClient.tsx` (School Admin's approved-student list) and `StudentSkillManager.tsx` (Teacher's own student list) both link to it as "View Profile →" / "View full profile →".

**Verified live**: a School Admin viewing the page saw a private (unshared) evaluation correctly; an approved Teacher at the same school (with no assignment to that specific student) also saw the full profile, confirming the Skills-page-style school-wide access; an *unapproved* teacher at the same school attempting direct navigation to the URL was redirected away, and a direct `PATCH` to that student's meeting as the same unapproved teacher returned `403`; a Student attempting direct navigation to their own profile URL was redirected away (Students have no access to this staff surface, including their own).

## Known scope decisions — deliberate, not oversights ⚠️

- **A meeting's `outcomeNotes` are not audited**, and neither is rescheduling. Only `StudentEvaluation.remarks` has the audit-on-share requirement (explicitly specified); a meeting's outcome notes and schedule remain freely editable, current-state data, consistent with `TeacherAcademicAssignment`'s own non-audited precedent.
- **No un-share path for evaluations.** Matches the explicit "permanent once released" design decision — revisit if a correction-after-sharing need arises.
- **No assignment-level scoping on the Student Profile page.** Deliberately matches the Skills-page precedent (any approved teacher/admin at the school) rather than introducing a new, narrower rule for this one surface — see above.

## Deliberately out of scope

Per the approved Phase 3C design (both slices): formal term-wide examinations beyond Unit/Chapter Tests, continuous/aggregate progress rollups, parent-initiated meeting requests, and any recurrence/series concept for Parent-Teacher Meetings are all untouched by this work — reserved for a later Phase 3C sub-phase, to be designed separately.
