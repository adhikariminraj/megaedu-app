# Assessment & Evaluation — Teacher Qualitative Evaluation and Parent-Teacher Meetings (Phase 3C)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30, against the current codebase.
> Part of **Phase 3 — School Academic System**. This document covers Phase 3C's first slice only — Teacher Qualitative Evaluation and Parent-Teacher Meetings. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) (Phase 3A), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md) (Phase 3B), and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles this phase reuses.

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

Both `fetchAcademicProgress(studentId, audience)` (`dashboard/page.tsx`) and `AcademicProgressPanel.tsx` (`src/components/AcademicProgressPanel.tsx`) were extended with this in mind: the function takes an explicit `audience: "STUDENT" | "PARENT"` parameter and filters `StudentEvaluation` rows on the matching boolean — the Student branch always calls it with `"STUDENT"`, the Parent branch always with `"PARENT"`, per child, never shared or reused between the two.

## Parent-Teacher Meetings — periodic and occasional, one model ✅

`ParentTeacherMeeting` handles both cases through the identical model and the identical route — the only difference is cardinality, not mechanism:

- **Occasional** (a single meeting) and **periodic** (e.g. a PTM week for a whole grade) both go through `POST /api/schools/[id]/meetings`, body `{meetings: [...]}` — one item for occasional, many for periodic. No separate "recurring series" concept was built; nothing in the approved design asked for recurrence rules, and adding one would have been unnecessary complexity for a need this route already satisfies by letting the caller submit as many items as they want in one request.
- **Every item is resolved and validated before the transaction opens** — the Postgres-safe pattern already used by `grade-decisions`/the rollover sweep, not the SQLite-only catch-mid-transaction pattern used by `grade-placements`/`teacher-assignments` (see [KNOWN_GAPS.md](KNOWN_GAPS.md) for that documented risk) — so this route doesn't add a third instance of it.
- **Initiation**: School Admin or an authorized Teacher only (`requireTeacherAssignment`/`requireClassTeacher`-validated per item, resolved from each item's actual student placement, never trusted from client-sent scope). **Parents have no write path at all** in this phase — read-only recipients. A parent-initiated meeting request was explicitly out of scope for this phase (may be considered later).
- **Editing an existing meeting** (`PATCH /api/schools/[id]/meetings/[meetingId]` — status, `outcomeNotes`, `linkedEvaluationId`) is authorized by identity rather than re-derived scope: a School Admin, or specifically the teacher the meeting's own `teacherId` names. Since the row already captures a committed relationship, there's no need to re-verify the teacher still holds a matching assignment the way *creation* does.

**Verified live**: a School Admin bulk-scheduled 2 meetings in one request (`created: 2, skipped: 0`) on behalf of a named teacher; a teacher without a matching assignment attempting to schedule "as" a different, named teacher was rejected (`skipped`, nothing created); a Subject Teacher successfully self-scheduled a subject-specific meeting for their own scope; marking a meeting `COMPLETED` with `outcomeNotes` and a `linkedEvaluationId` persisted all three fields correctly (confirmed via a direct API round-trip); cancelling a different meeting set `status: CANCELLED` correctly.

## Linking an evaluation to a meeting ✅

`ParentTeacherMeeting.linkedEvaluationId` is a plain (non-unique) FK to `StudentEvaluation` — many meetings may reference the same evaluation (e.g. a follow-up meeting revisiting the same prepared note), validated at write time to belong to the same student as the meeting. Wired into the UI as an evaluation picker shown when marking a meeting `COMPLETED` on `/dashboard/evaluations` — a teacher can attach a prepared evaluation as context for the outcome being recorded. **Verified live**: linking a real evaluation to a meeting on completion round-tripped correctly through the API and was visible on the resulting `meeting.linkedEvaluationId`.

## Parent-Teacher Meetings are Parent-visible only — Students have no visibility yet ✅

`fetchParentMeetings(studentId)` (`dashboard/page.tsx`) is called **only** from the PARENT branch — not part of `fetchAcademicProgress()`, and never called from the STUDENT branch at all. This is a structural guarantee, not a hidden UI section: there is no code path in the Student's own page render where `ParentTeacherMeeting` is ever queried, so there's no query result that could accidentally leak into the Student's view even if a future edit to `AcademicProgressPanel.tsx` were careless about it.

**Verified live**: a Student whose General Evaluation and meetings both existed and were fully populated saw Teacher Evaluations (both shared ones) but **no Parent-Teacher Meetings section anywhere on their dashboard** — confirmed by direct page-text inspection, not just visual absence.

## Read-side UI ✅

- **School Admin** — `/dashboard/evaluations` (General Evaluations, any grade/section) and the "Subject Evaluations" panel on `/dashboard/academics/[gradeSubjectId]` (any subject/section); both also carry the "Schedule Meeting" / meeting-management UI on the General Evaluations page.
- **Teacher** — the same two surfaces, scoped to their own `ClassTeacherAssignment`/`TeacherAcademicAssignment`s; `TeacherDashboard.tsx`'s existing "Your Class & Section Teacher Responsibilities" section gained a second link ("General evaluation →") alongside the existing "Take attendance →" one.
- **Student** — a new "Teacher Evaluations" block in `AcademicProgressPanel.tsx`, showing only `visibleToStudent: true` rows, each labeled "General Evaluation" or the subject's name.
- **Parent** — the same block (via the shared panel, `visibleToParent`-filtered) plus a new, dedicated "Parent-Teacher Meetings" section on `ParentDashboard.tsx` per linked child (deliberately **not** part of the shared `AcademicProgressPanel`, so there is no shared component a Student's render path could ever pull meeting data through).

## Known scope decisions — deliberate, not oversights ⚠️

- **Meeting-scheduling UI exists only on `/dashboard/evaluations` (General), not yet on the Subject Evaluations panel.** The backend (`POST /api/schools/[id]/meetings`) fully supports a `gradeSubjectId`-scoped meeting — verified directly via the API — but the UI entry point for scheduling one from the Subject Evaluations panel hasn't been built yet. A Subject Teacher can still be the *subject* of a meeting scheduled from the General Evaluations page (by an Admin or a Class/Section Teacher naming them), just not self-serve it from their own subject page yet.
- **A meeting's `outcomeNotes` are not audited.** Only `StudentEvaluation.remarks` has the audit-on-share requirement (explicitly specified); a meeting's outcome notes remain freely editable, current-state data, consistent with `TeacherAcademicAssignment`'s own non-audited precedent.
- **No un-share path for evaluations.** Matches the explicit "permanent once released" design decision — revisit if a correction-after-sharing need arises.

## Deliberately out of scope

Per the approved Phase 3C-1 design: formal term-wide examinations beyond Unit/Chapter Tests, continuous/aggregate progress rollups, parent-initiated meeting requests, and any recurrence/series concept for Parent-Teacher Meetings are all untouched by this work — reserved for a later Phase 3C sub-phase, to be designed separately.
