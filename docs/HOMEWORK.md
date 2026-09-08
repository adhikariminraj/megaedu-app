# Homework

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-08 (K2 — Homework Completion foundation), against the current codebase.

## The fundamental flow ✅

```
Teacher → creates Homework (Regular or Individual) → publishes
        → HomeworkApplicability resolved & persisted at that moment
        → Students see it → Parents see today's due homework for each child
        → Subject Teacher records Completion per applicable student (K2)
```

Approved product definition: **Assign → Complete → Teacher Review → Feedback**. Online submission is optional evidence, never the definition of completion — K2 builds the "Complete" step as a Teacher-recorded decision that works identically for offline (notebook/paper/oral/practical) and online work, since no submission mechanism exists or is required. Teacher Review and Feedback remain unbuilt (see "Explicitly out of scope," below).

One `Homework` row describes the assignment. **`HomeworkApplicability`** (K1) is the one canonical, universal Student ↔ Homework relationship — `Homework.studentId` does not exist and must not be added. Regular Homework (targeting a grade/section) resolves to many `HomeworkApplicability` rows; Individual Homework (targeting exactly one student) resolves to exactly one. Applicability is resolved **once, at the moment of publication** — never recalculated later, never derived live from a student's current placement at read time. See "Homework Applicability (K1)" below for the full model.

Student and Parent visibility of *today's* homework is still resolved at read time by matching a student's current institutional placement against `Homework`'s own scope (`fetchTodaysHomework()`, below) — this remains a live, always-current query, distinct from `HomeworkApplicability`'s historical, resolve-once record.

## Data model ✅

`Homework` (`prisma/schema.prisma`) — see [DATABASE.md](DATABASE.md) for the full field list. In short:
- `academicSessionId`, `schoolGradeId`, `sectionId?`, `gradeSubjectId`, `subjectId` — the same institutional scoping shape already used by `TeachingUnit`/`TeacherAcademicAssignment`. `sectionId: null` = grade-wide; a real value = that section only, following the three-way `sectionScopeWhere()` idiom (`src/lib/authorize.ts`) used throughout Phase 3.
- `teacherId → Teacher` — the real institutional Teacher identity, **not** just a `createdByUserId → User` audit field (unlike `TeachingUnit`/`UnitTest`). Matches `StudentEvaluation`'s precedent instead: authorship resolves through the Teacher identity, never the raw account. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).
- `title`, `instructions`, `dueDate` (date-only, see below).
- `status` (`DRAFT` | `PUBLISHED`) and `publishedAt?` — a single gate for **both** Student and Parent visibility simultaneously. Deliberately not two independent flags like `StudentEvaluation.visibleToParent`/`visibleToStudent` — nothing in Phase 1's product direction calls for an asymmetric audience between a student and their own parent.

Once `PUBLISHED`, `title`/`instructions`/`dueDate`/`sectionId` are frozen (a `PATCH` attempting to change them returns `409`) — matching the "permanent once shared" precedent already established for `StudentEvaluation` sharing and `Certificate` issuance. Only the `DRAFT → PUBLISHED` transition itself is allowed afterward, and it's idempotent (publishing an already-published item is a harmless no-op).

## Date semantics — "today" vs. "due today" ✅

`dueDate` is date-only, following the `Attendance.date`/`UnitTest.testDate`/`AcademicSession.startDate` convention: always derived from a client-supplied `"YYYY-MM-DD"` string via `new Date(dateString)`, never a server-computed "today" — the same byte-identical UTC-midnight value every time makes plain equality (`dueDate: parsedDate`) a reliable exact match.

"Today's Homework," for both the Student and Parent read paths, means **homework whose `dueDate` equals today's calendar date** — not "published today." "Today" itself is resolved via `todayInKathmandu()` (`src/lib/homework.ts`), using `Intl.DateTimeFormat` with an explicit `Asia/Kathmandu` anchor — **deliberately not** `new Date().toISOString().slice(0, 10)` (the pattern used elsewhere in this codebase, e.g. `dashboard/attendance/page.tsx`, purely as an overridable UI default). Nepal Standard Time is UTC+5:45; the UTC calendar date diverges from Nepal's actual local date for roughly the first ~5h45m of every Nepal day (Nepal local midnight through ~05:44 local), which is exactly the early-morning window a parent checking homework before the school day starts is most likely to hit. `Asia/Kathmandu` is hardcoded — this platform is Nepal-only today, and no `School` has ever had (or needed) its own timezone field; adding one now would be speculative infrastructure for a scenario that doesn't exist yet. No date/timezone package was installed — `Intl.DateTimeFormat` is native.

## Shared read function ✅

`fetchTodaysHomework(studentId, schoolId)` (`src/lib/homework.ts`) is the **one** place this query is written — shared by the Student's own dashboard and, once per linked child, the Parent dashboard, matching the exact "one function, every caller" discipline already established by `fetchAcademicProgress()` (`src/lib/academicProgress.ts`). It:
1. Resolves the student's current placement via `resolveCurrentPlacement(studentId, schoolId)` (`src/lib/gradeHistory.ts`) — scoped to the caller's own trusted `schoolId` (never inferred), so a student whose `GradeHistory` touches more than one school can never resolve an unrelated school's session. No placement, no homework, returns `[]`.
2. Resolves today's date via `todayInKathmandu()`.
3. Queries `PUBLISHED` `Homework` matching that placement's `academicSessionId`/`schoolGradeId`, `dueDate = today`, and the student's own `sectionId` via `sectionScopeWhere()` (grade-wide OR that exact section).

Like `fetchAcademicProgress()`, this function does no authorization itself — callers are responsible for only ever passing a `studentId` they've already verified the caller is allowed to see. (This corrects an earlier, pre-institutional-context-hardening version of this section that described an unscoped `GradeHistory.findFirst()` lookup — documentation-only correction, no behavior change from this note.)

## Homework Applicability (K1) ✅

`HomeworkApplicability` (`prisma/schema.prisma`) is the sole, canonical Student ↔ Homework relationship — see the model's own comment for the full architectural rationale. Key properties:

- **Created once, at publish time**, inside the same transaction as the `DRAFT → PUBLISHED` transition (`publishHomework()`, `src/lib/homework.ts`) — never at draft creation, never recalculated afterward.
- **Regular Homework** (`Homework.targetStudentId` is `null`): resolves to every student whose `GradeHistory` currently places them in the homework's `schoolGradeId` (+ `sectionId`, if section-specific), using the same `CURRENT_ROSTER_STATUSES` definition every other roster-scoped feature in this codebase shares.
- **Individual Homework** (`Homework.targetStudentId` set): resolves to exactly one `HomeworkApplicability` row, for that student — re-validated fresh, at publish time, against the same current-roster criteria; a target who is no longer eligible (transferred, left) causes publication to fail with a `409`, rather than creating a stale row.
- **Immutable in K1** — no update or delete path exists. A student's later section change, grade change, or school transfer never rewrites or removes an existing row (`disassociate ≠ delete`, the same principle governing `GradeHistory`/affiliations elsewhere in this schema).
- **Exactly-once, verified empirically** against this repository's actual SQLite/Prisma behavior (the same methodology proven for `AcademicSession` transitions and assessment-result corrections): a fresh `Homework.status` re-check inside the publish transaction is what actually prevents a duplicate batch on a concurrent/retried publish request; `@@unique([homeworkId, studentId])` is the database-level backstop behind it.
- **No late-joiner auto-add** — a student who joins a grade/section after a homework was published is never retroactively added to it.

**Individual Homework targeting** is exposed in the create form (`HomeworkClient.tsx`) as "Assign to: Entire Section / Individual Student," with the student picker scoped to whichever grade/subject/section option is currently selected. Creation-time validation confirms the target student is currently placed in the intended grade/session and derives the authorization scope (grade-wide or the target's own section) from their real current section — not merely "does this teacher teach this subject somewhere in the grade."

**Explicitly out of scope for K1** — Completion (now built, see below), Online Submission, Feedback, Class/Grade/School progress rollups, notifications, homework marks, any connection to formal assessment. See [KNOWN_GAPS.md](KNOWN_GAPS.md).

## Homework Completion (K2) ✅

`HomeworkCompletion` (`prisma/schema.prisma`) records one Subject Teacher decision per `HomeworkApplicability` row — "did this student complete this homework." It is deliberately keyed to `HomeworkApplicability`, never to `Homework`/`Student` directly, and never introduces a second Student ↔ Homework relationship: `HomeworkApplicability` remains the sole canonical link (K1's own invariant, unchanged).

- **Statuses**: `COMPLETED` | `PARTIAL` | `NOT_COMPLETED` | `EXCUSED` — all four are explicit teacher decisions. The **absence** of a `HomeworkCompletion` row means "not yet recorded" — this is never coerced into any of the four statuses by any reader, and no code path ever auto-creates one (no due-date sweep, no absence/leave/transfer inference, no retroactive backfill for pre-K2 Homework/Applicability rows).
- **One current row per Applicability, plus an audit trail.** `recordOrCorrectCompletion()` (`src/lib/homeworkCompletion.ts`) is the only write path: the first recording creates the row (no audit — creation isn't a correction, the same principle already governing `GradeHistoryAudit`/`StudentEvaluationAudit`); every subsequent correction updates the row in place and inserts a `HomeworkCompletionAudit` row in the same transaction — mirroring `correctAttendance()`'s exact shape, not `MarkSheet`'s version-chain shape, since nothing downstream ever needs "completion as of a past moment."
- **Concurrency**: an H3-style optimistic-lock `version` field + CAS `updateMany()`, adopted deliberately (not by default) because `TeacherAcademicAssignment` explicitly permits more than one teacher to hold an overlapping assignment for the same subject/grade/section — a genuine, non-hypothetical two-teacher race for Homework specifically. Verified empirically both same-process (`Promise.allSettled`) and via two genuinely separate OS processes: exactly one write lands, the other receives `HomeworkCompletionConflictError` (409), never a silent overwrite. `@@unique([homeworkApplicabilityId])` (via the FK itself) is the database-level backstop.
- **Bulk recording, per-row independent transactions.** The real classroom workflow ("I checked 24 notebooks — 18 done, 3 partial, 2 not, 1 excused") is served by one page listing every applicable student with a status selector and one "Save" submitting all changed rows together — but the server applies each row through its **own** independent `recordOrCorrectCompletion()` call, never one all-or-nothing transaction across the batch. A stale-version conflict on one student never discards another student's legitimate write.
- **Authorization — Subject Teacher only, no Admin/Class Teacher/Grade Coordinator bypass.** Unlike the Homework `PATCH` route (which accepts Admin oversight), Completion recording is deliberately Teacher-only in K2, per explicit product decision: individual Homework Completion must not be silently given to School Admin/Class Teacher/Grade Coordinator merely because they administer or oversee the school/class.
  - **Regular Homework**: authorized against the Homework's own frozen `sectionId` (identical to the scope `PATCH` already re-verifies) — any teacher with a matching current `TeacherAcademicAssignment`, no ownership/creator lock.
  - **Individual Homework**: `Homework.sectionId` is always `null` here by K1 design, which is neither "any section" nor "grade-wide only." `resolveCompletionAuthorizationSectionScope()` (`src/lib/homeworkCompletion.ts`) freshly resolves the target student's placement **within the Homework's own `academicSessionId`/`schoolGradeId`** (via `resolveStudentPlacementInSession()`, `src/lib/gradeHistory.ts` — deliberately not `resolveCurrentPlacement()`, which is scoped to whichever session is currently ACTIVE and could resolve the wrong session entirely by the time completion is recorded) and authorizes against that student's *current* section (grade-wide OR that exact section). If the student has since transferred out of this grade or left the school (no current-roster placement), authorization falls back to grade-wide-only — a section-specific-only teacher has no remaining basis to record for a student no longer anywhere in the grade. This **never** reads, rewrites, or re-derives `HomeworkApplicability` — only the live authorization check's own scope input is resolved fresh, the same way every `requireTeacherAssignment()` caller in this codebase always checks current institutional state, never a frozen snapshot.
- **Historical integrity, confirmed by test**: a student's later section transfer or leaving the school never rewrites or removes any existing `HomeworkApplicability`/`HomeworkCompletion` row — only the *authorization scope for a future recording* changes.
- **Minimal UI**: `/dashboard/schools/[schoolId]/homework/[homeworkId]/completion`, reached via a "Record Completion" link shown only on `PUBLISHED` Homework rows and only to Teachers (never School Admin, matching the authorization decision above). No redesign of the existing Homework list — this is the only UI addition.

**Explicitly out of scope for K2** — Online Submission, attachments, teacher Feedback/remarks on a completion, Class Teacher/Grade Coordinator/School Admin progress-visibility surfaces, notifications, homework marks, any connection to formal assessment/GPA/Report Card/Mark Sheet. See [KNOWN_GAPS.md](KNOWN_GAPS.md).

## Parent visibility — reuses the existing Parent → ParentStudent → Student chain ✅

No new `ParentHomework` relationship was introduced. `dashboard/page.tsx`'s existing `PARENT` branch already resolves `parent.children` from the authenticated user's own `ParentStudent` rows — never a request-supplied `studentId` — and already fans out per-child reads (`fetchAcademicProgress`, `fetchMeetingsForStudent`, `fetchAssessmentResults`) via `Promise.all`. `fetchTodaysHomework(c.student.id)` was added as one more call in that same fan-out, reusing the identical security posture: *"childStudentIds is derived ENTIRELY from the logged-in parent's own resolved ParentStudent rows... so one child's data can never leak into another's."* `TodaysHomeworkPanel` (`src/components/TodaysHomeworkPanel.tsx`) is the shared presentational component rendered once on the Student's own dashboard and once per child on the Parent's — matching `AcademicProgressPanel`'s own reuse pattern.

## Teacher authorization ✅

Creation is gated by `requireTeacherAssignment()` (`src/lib/authorize.ts`) alone — **not** composed with `requireSchoolAdmin()` the way the analogous `TeachingUnit` create route is. `Homework.teacherId` is a real, non-nullable `Teacher` FK, and nothing in the approved Phase 1 scope describes a School Admin authoring "on behalf of" a named teacher the way Evaluations does — restricting creation to the caller's own resolved Teacher identity avoids that ambiguity entirely. Editing/publishing (`PATCH`) accepts either `requireSchoolAdmin()` (oversight) or `requireTeacherAssignment()` re-checked fresh against the homework row's own stored scope — never just "are you the teacher who originally created this," matching the no-hierarchy-among-teachers precedent already established for `TeacherAcademicAssignment`.

The three-way `sectionId` semantics (`sectionScopeWhere()`) are unweakened: a teacher holding only section-specific assignments (e.g. Section A and B, but no grade-wide row) is correctly rejected from creating grade-wide (`sectionId: null`) homework — confirmed live during Phase 1 testing.

## Routes ✅

- `POST /api/schools/[id]/homework` — create a `DRAFT`. Teacher-only (see above). Every relational id (`gradeSubjectId`, `sectionId`) is re-resolved and cross-checked server-side against the URL's school — never trusted from the client in isolation, matching the `TeachingUnit` create route's exact validation shape.
- `PATCH /api/schools/[id]/homework/[homeworkId]` — edit `DRAFT` fields and/or publish. Re-verifies the homework's own `schoolGradeId` belongs to the URL's school (defense in depth against a forged `homeworkId` even when the caller is a genuine admin/teacher elsewhere).

## Teacher experience ✅

`/dashboard/schools/[schoolId]/homework` — URL-scoped from day one via `verifySchoolAccess()` (Phase 4D pattern). Unlike Attendance/Evaluations/Meetings, Homework has **no unscoped legacy sibling page** — it's a brand-new feature with no pre-Phase-4D history to preserve, so it skips straight to the pattern those features were migrated *to*. Reachable via: a link on the School Admin's main dashboard (next to "Inquiries"), a link on the Teacher's main dashboard (next to "Assessment Results"), and a link on the Phase 4D-1 multi-school chooser page — the same discoverability approach already used for Inquiries.

## Student & Parent experience ✅

- **Student** (`dashboard/page.tsx`'s `STUDENT` branch → `StudentDashboard.tsx`): a "Today's Homework" section, subject/title/instructions per item.
- **Parent** (`PARENT` branch → `ParentDashboard.tsx`): the same section, once per linked child, grouped under that child's card.

## Explicitly out of scope for Phase 1 / K1 🔭

Student submissions, file attachments, grading, rubrics, teacher feedback, discussion, plagiarism checking, analytics, reminders/notifications, completion tracking, upcoming/past homework views. See [KNOWN_GAPS.md](KNOWN_GAPS.md). ("Homework categories/types" is now partially addressed — K1 added Regular vs. Individual as an *assignment-target* distinction; this is not the same as a subject-matter category/tag system, which remains out of scope.)
