# Database

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30 (Phase 3C — Teacher Qualitative Evaluation & Parent-Teacher Meetings), against `prisma/schema.prisma` directly.

**Datasource**: SQLite in development (`prisma/dev.db`); `.env.example` and the schema's own header comment both mark PostgreSQL as the intended production target (nothing production-specific is configured yet — see [DEPLOYMENT.md](DEPLOYMENT.md)). **No Prisma `enum`s are used anywhere** — SQLite's connector doesn't support them, even unused ones — every status/type/role field is a plain `String`, with valid values documented in a comment above the field.

Every model below is ✅ implemented (exists, migrated, and has at least one route reading/writing it) unless marked otherwise.

---

## MEGA ID ✅

### `User`
**Purpose**: the single identity record — one MEGA ID, one login, potentially many roles. **Currently used**: yes, everywhere; every other model traces back to a `User` for who did what.
**Key fields**: `id, email (unique), passwordHash, name, createdAt, updatedAt`.
**Relationships**: `roles` (`UserRole[]`), profile records (`teacherProfile`, `studentProfile`, `parentProfile` — each optional 1:1), admin/accountant links, `subscriptions`, `payments`, `notifications`, `interests`, `skillsAdded`, `instructorProfile`, `certificatesReceived`, `gradeDecisionsMade`, `gradeHistoryAuditsMade`.
**Constraints**: `email` unique.
**Delete behavior**: deleting a `User` cascades to `UserRole`, `Teacher`, `Student`, `Parent`, admin/accountant links, `Interest`, `Notification` (all `onDelete: Cascade`) — but there is no delete route anywhere in the app today; this is schema-level behavior only, never exercised by any UI action.

### `UserRole`
**Purpose**: which role(s) a `User` holds. **Currently used**: yes, read on every login and every authorization check.
**Key fields**: `id, userId (FK), role (String)`. Valid values: `PLATFORM_ADMIN | SCHOOL_ADMIN | TEACHER | STUDENT | PARENT | ORGANIZATION_ADMIN | ACCOUNTANT`.
**Constraints**: `@@unique([userId, role])` — a user can't hold the same role twice, but can hold several different roles.
**Delete behavior**: cascades from `User`.

---

## School ✅

### `School`
**Purpose**: a verified, listed education institution. **Currently used**: yes, extensively.
**Key fields**: `id, name, slug (unique), type?, location?, district?, contactEmail?, contactPhone?, gradesOffered?, description?, logoUrl?, coverImageUrl?, verified (default false), isActive (default true), subscriptionTier (default "FREE")`.
**Relationships**: admins, accountants, teachers, students, programs, news, opportunities, resources, subscriptions, issued/associated certificates, `academicSessions`, `grades` (`SchoolGrade[]`).
**Constraints**: `slug` unique.
**Delete behavior**: no delete route exists for `School` at all.
**Notes**: `verified` is set only by a Platform Admin. ⚠️ `isActive` is read in two places (`schools/search` filter, Platform Admin dashboard counts) but **nothing in the app ever sets it to `false`** — there is no deactivation action. `logoUrl` exists but is unpopulated on every school in the current database and has no upload UI. `gradesOffered` is unstructured free text, unrelated to the Phase 2 `SchoolGrade` model.

### `SchoolAdmin` / `SchoolAccountant`
**Purpose**: join tables granting School Admin / Accountant access to a specific school. **Currently used**: yes.
**Key fields**: `userId, schoolId`.
**Constraints**: `@@unique([userId, schoolId])` each — a school can have multiple admins/accountants.
**Delete behavior**: cascades from both `User` and `School`.
**Notes**: `SchoolAccountant` is granted directly by a School Admin (`POST /api/schools/[id]/accountants`) — there's no self-registration or approval queue for this role.

### `Program`, `NewsPost`
Simple school-owned content, no approval workflow. Currently used (School Admin dashboard).

---

## People ✅

### `Teacher`
**Purpose**: a teacher's profile at (optionally) one school. **Currently used**: yes.
**Key fields**: `id, userId (unique FK), schoolId?, bio?, subjects?, position (default "Teacher"), approved (default false)`.
**Relationships**: `courseEnrollments`, `gradeAssignments` (`TeacherGradeAssignment[]`).
**Delete behavior**: cascades from `User`.
**Notes**: unaffiliated until joining a school; re-joining always resets `approved` to `false`.

### `Student`
**Purpose**: a student's profile at (optionally) one school — also the anchor for Phase 2 grade placement. **Currently used**: yes, heavily.
**Key fields**: `id, userId (unique FK), schoolId?, gradeLevel?, approved (default false)`.
**Relationships**: `parents` (`ParentStudent[]`), `courseEnrollments`, `skills`, `gradeHistory` (`GradeHistory[]`).
**Delete behavior**: cascades from `User`.
**Notes**: `gradeLevel` is the **legacy free-text grade** — permanently retained as a fallback, no longer written to once a school completes Initial Setup, never scheduled for removal (see [PRODUCT_RULES.md](PRODUCT_RULES.md)).

### `Parent`, `ParentStudent`
**Purpose**: a parent's linked children. **Currently used**: yes.
**Constraints**: `@@unique([parentId, studentId])`. Linking requires the child to already exist as a `Student` (matched by email).
**Delete behavior**: cascades from both sides.

---

## Academic Sessions & Grades — Phase 2 ✅ (fully implemented and in active use)

All seven models below are pushed to the database **and** actively read/written by real routes — this is no longer schema-only. See [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) and [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) for the full behavioral write-up; this section covers structure only.

### `AcademicSession`
**Purpose**: one school-year window for a school. **Currently used**: yes — Initial Setup, Promotion, and New Session rollover all depend on it.
**Key fields**: `id, schoolId (FK), name, startDate, endDate, status (default "ACTIVE")`. Valid `status`: `ACTIVE | CLOSED`.
**Constraints**: one `ACTIVE` session per school, enforced at the application level (not a DB constraint — SQLite can't express a partial unique index here).
**Delete behavior**: cascades from `School`; no delete route exists (sessions are closed, never deleted).

### `GradeReference`
**Purpose**: the platform-wide, fixed grade ladder. **Currently used**: yes — seeded once (`PP1`–`PP3`, `Y1`–`Y10`, 13 rows), read by every grade-configuration screen.
**Key fields**: `id, code (unique), order (unique Int)`.
**Delete behavior**: no delete route; not school-editable at all.

### `SchoolGrade`
**Purpose**: a school's opt-in to one `GradeReference`, with its own display label. **Currently used**: yes.
**Key fields**: `id, schoolId (FK), gradeReferenceId (FK), displayName`.
**Constraints**: `@@unique([schoolId, gradeReferenceId])`.
**Relationships**: `sections` (`Section[]`) — added for the Section system, below.
**Delete behavior**: cascades from `School`; the creation route (`POST /api/schools/[id]/grades`) is additive-only — it never deletes a `SchoolGrade` a school previously opted into.

### `Section`
**Purpose**: an optional subdivision of a `SchoolGrade` (e.g. Class 6 → sections A, B, C). **Currently used**: yes.
**Key fields**: `id, schoolGradeId (FK), name, isActive (default true), createdAt`.
**Constraints**: `@@unique([schoolGradeId, name])` — no two sections in the same grade can share a name; a deactivated section's name is still reserved (renaming a different section to reuse it is blocked the same way an active collision would be).
**Delete behavior**: cascades from `SchoolGrade`. **No delete route exists** — sections are soft-deactivated only (`isActive: false`), never hard-deleted, so a `GradeHistory` row that references one always resolves to real data, even for a section a school has since retired.
**Notes**: not session-scoped — a `Section` belongs to a `SchoolGrade`, which is itself school-wide (not per-session), so the same section rows carry across academic sessions. Creation is bulk (`POST .../sections`, comma-separated names, deduplicated, existing-name collisions silently skipped) and additive-only, mirroring `SchoolGrade`'s own creation route. See [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md#sections-).

### `TeacherGradeAssignment`
**Purpose**: per-session teacher-to-grade link. **Currently used**: yes.
**Key fields**: `id, teacherId (FK), schoolGradeId (FK), academicSessionId (FK)`.
**Constraints**: `@@unique([teacherId, schoolGradeId, academicSessionId])`.
**Delete behavior**: cascades from `Teacher`; a `DELETE` route exists (`/api/schools/[id]/teacher-assignments/[assignmentId]`) for removing a single mistaken assignment. Never auto-carried-forward to a new session.

### `GradeHistory`
**Purpose**: a student's grade placement for one session — the permanent record. **Currently used**: yes, the central Phase 2 table.
**Key fields**: `id, studentId (FK), schoolGradeId (FK), sectionId? (FK to Section), academicSessionId (FK), status (default "ENROLLED"), enrolledAt, decidedAt?, decidedByUserId? (FK), outcomeGradeId? (FK to SchoolGrade)`. Valid `status`: `ENROLLED | COMPLETED | REPEATED | TRANSFERRED | LEFT`.
**Constraints**: `@@unique([studentId, academicSessionId])` — one placement per student per session.
**Delete behavior**: cascades from `Student`; **no delete route exists anywhere** — rows are permanent by design, a repeat or promotion creates a new row in the next session rather than editing this one.
**Critical rule**: `status`/`outcomeGradeId` may only ever be written through `recordGradeDecision()` (`src/lib/gradeHistory.ts`); `sectionId` on an *existing* row may only ever be written through `reassignSection()` (same file) — see [PRODUCT_RULES.md](PRODUCT_RULES.md).
**Notes**: `sectionId` is optional and, unlike `schoolGradeId`, is **never auto-copied** — not by `recordGradeDecision()` (a promotion/repeat/transfer/leave decision never touches the current row's section), and not by the rollover carry-forward sweep (a new session's row is always created with `sectionId` absent from the `create()` call, i.e. `null`, regardless of what section the student held before). Section assignment is a separate, always-explicit action per session — see [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md#sections-).

### `GradeHistoryAudit`
**Purpose**: append-only log of every decision made on a `GradeHistory` row. **Currently used**: yes — one row per decision, verified 1:1 in multiple live tests.
**Key fields**: `id, gradeHistoryId (FK), changedByUserId (FK), changedAt, previousStatus, previousOutcomeGradeId?, previousSectionId?, newStatus, newOutcomeGradeId?, newSectionId?`.
**Constraints**: none beyond FKs. `previousOutcomeGradeId`/`newOutcomeGradeId`/`previousSectionId`/`newSectionId` are deliberately plain nullable strings, **not** live FK relations to `SchoolGrade`/`Section` — a frozen snapshot, for the same reason `Certificate`'s `*NameSnapshot` fields are plain strings.
**Delete behavior**: cascades from `GradeHistory`; no update or delete route ever touches this table — `recordGradeDecision()` and `reassignSection()` are the only writers and only ever insert.
**Notes**: `previousSectionId`/`newSectionId` are written on **every** audit row, including ones produced by `recordGradeDecision()` (a promotion decision) — the current section is carried through unchanged (`previousSectionId === newSectionId`) so the audit trail always shows what section a student was in at the moment of any decision, even though the decision itself didn't change it. This is what preserves "what section was this student in when they were promoted" even though promotion and section assignment are otherwise independent actions. Verified live: a student assigned to Section A, then promoted, produced two audit rows in sequence — `null→A` (the assignment) and `A→A` alongside `ENROLLED→COMPLETED` (the promotion) — the full chronology stays intact.

---

## Subjects & Teacher Academic Assignment — Phase 3A ✅ (fully implemented and in active use)

Additive on top of Phase 2/the Section system — no existing model's columns changed, only new relation-array fields on `School`, `Teacher`, `AcademicSession`, `SchoolGrade`, and `Section`. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) for the full behavioral write-up; this section covers structure only.

### `Subject`
**Purpose**: a school-wide subject catalog entry. **Currently used**: yes.
**Key fields**: `id, schoolId (FK), name, code?, isActive (default true), createdAt`.
**Constraints**: `@@unique([schoolId, name])`.
**Delete behavior**: cascades from `School`; **no delete route exists** — deactivate only (`isActive`), same precedent as `Section`, since a real `GradeSubject`/`TeacherAcademicAssignment` may already reference it.
**Notes**: reusable across every grade and every academic session — a school defines a subject once, not once per grade.

### `GradeSubject`
**Purpose**: which subjects a grade offers, for one specific academic session. **Currently used**: yes.
**Key fields**: `id, schoolGradeId (FK), subjectId (FK), academicSessionId (FK), createdAt`.
**Constraints**: `@@unique([schoolGradeId, subjectId, academicSessionId])`.
**Delete behavior**: cascades from `SchoolGrade`/`Subject`; a real `DELETE` route exists (`.../grades/[schoolGradeId]/subjects/[gradeSubjectId]`) — blocked with `409` if a `TeacherAcademicAssignment` already references it, otherwise removed outright. Unlike `Section`/`Subject`, nothing permanent points at a `GradeSubject` row, so a hard delete is safe.
**Notes**: **not** reusable config like `SchoolGrade`/`Section` — every academic session starts with zero `GradeSubject` rows for every grade, never auto-copied from the prior session (same non-carry-forward pattern as `TeacherGradeAssignment`). This is what keeps a past session's curriculum permanently reconstructable even after the school later changes its subject list.

### `TeacherAcademicAssignment`
**Purpose**: a teacher's subject-teaching assignment for one session. **Currently used**: yes.
**Key fields**: `id, teacherId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK to Section), subjectId (FK), gradeSubjectId (FK), createdAt`.
**Constraints**: `@@unique([teacherId, academicSessionId, schoolGradeId, sectionId, subjectId])` — catches an exact duplicate reliably (SQL unique indexes work normally when `sectionId` is a real value). Does **not**, by itself, prevent two grade-wide (`sectionId: null`) rows for the same tuple — SQL treats `NULL ≠ NULL` in unique indexes — so the grade-wide/section-specific overlap rule is enforced in the route, not the schema (same class of app-level rule as the one-`ACTIVE`-session-per-school check).
**Delete behavior**: cascades from `Teacher`/`AcademicSession`/`SchoolGrade`/`GradeSubject`; a real `DELETE` route exists (`.../teacher-academic-assignments/[assignmentId]`) — not audited, same as `TeacherGradeAssignment`'s own delete route.
**Notes**: `sectionId: null` means grade-wide (every section); a real value means one specific section — a grade-wide row always "covers" every section for permission-checking purposes (see `requireTeacherAssignment()` in [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)). `gradeSubjectId` is the source of truth that this subject is actually offered at this grade in this session — the FK cannot be created otherwise; `schoolGradeId`/`subjectId`/`academicSessionId` are denormalized alongside it purely for query convenience. Multiple different teachers may hold overlapping assignments for the same subject/grade/section — no hierarchy, no primary/assistant/substitute concept.

---

## School Academic Operations — Phase 3B ✅ (fully implemented and in active use)

Seven new models, additive on top of Phase 2/3A — no existing model's columns changed, only new relation-array fields. See [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md) for the full behavioral write-up; this section covers structure only.

### `ClassTeacherAssignment`
**Purpose**: a designated Grade Class Teacher (`sectionId: null`) or Section Teacher (`sectionId` set) — special day-to-day responsibility, distinct from subject-teaching. **Currently used**: yes.
**Key fields**: `id, teacherId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK to Section), createdAt`.
**Constraints**: `@@unique([schoolGradeId, sectionId, academicSessionId])` — uniqueness is on the *slot* (at most one Class/Section Teacher per grade-or-section, per session), not the teacher; the same teacher may hold multiple slots across different grades/sections. **Unlike `TeacherAcademicAssignment`, grade-wide and section-specific rows may coexist for the same grade** — no overlap rule.
**Delete behavior**: cascades from `Teacher`/`AcademicSession`/`SchoolGrade`; a real `DELETE` route exists — not audited, current-state operational data.
**Notes**: ⚠️ the `@@unique` above reliably catches a duplicate *section-specific* slot but, on its own, does **not** catch a second *grade-wide* row for the same grade/session (`NULL ≠ NULL` in a unique index, same caveat as `TeacherAcademicAssignment`'s overlap rule) — this was found via a live duplicate-creation test during Phase 3B and fixed with an explicit app-level pre-check inside the create route's transaction, re-verified in both a single-request and an in-batch scenario.

### `Attendance`
**Purpose**: one row per student per calendar day — never subject-based. **Currently used**: yes.
**Key fields**: `id, studentId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK to Section), date, status, remarks?, markedByUserId (FK), markedAt`. Valid `status`: `PRESENT | ABSENT | LATE | EXCUSED`.
**Constraints**: `@@unique([studentId, date])` — global, not per-session, matching "one status per school day" literally.
**Delete behavior**: cascades from `Student`; no delete route — corrections go through `correctAttendance()` (updates in place, audited), never a raw delete.
**Notes**: `date` is always derived from a client-sent `"YYYY-MM-DD"` string via `new Date(dateString)` — the same convention already used for `AcademicSession.startDate`/`endDate` — never from the server's own clock, so the value always represents the school's intended calendar day regardless of server timezone. `schoolGradeId`/`sectionId` are a snapshot of the student's `GradeHistory` placement at marking time, not independently editable.

### `AttendanceAudit`
**Purpose**: append-only correction log for `Attendance`. **Currently used**: yes.
**Key fields**: `id, attendanceId (FK), changedByUserId (FK), changedAt, previousStatus, newStatus, previousRemarks?, newRemarks?`.
**Constraints**: none beyond FKs.
**Delete behavior**: cascades from `Attendance`; no update or delete route ever touches this table — `correctAttendance()` (`src/lib/attendance.ts`) is the sole writer and only ever inserts.
**Notes**: every correction records **both** status and remarks, even when only one actually changed (the unchanged field is echoed) — same "full snapshot every time" pattern as `GradeHistoryAudit`.

### `TeachingPlan`
**Purpose**: a teacher's declared planned-total and display-label (Unit/Chapter) for one subject/grade/section/session. **Currently used**: yes.
**Key fields**: `id, gradeSubjectId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK to Section), subjectId (FK), plannedTotal, unitLabel (default "Unit"), createdByUserId (FK), createdAt, updatedAt`.
**Constraints**: `@@unique([gradeSubjectId, sectionId])` — at most one plan per grade-subject-and-section scope.
**Delete behavior**: cascades from `GradeSubject`; no delete route — the creation route is find-or-update-else-create, not a bare insert (same NULL-uniqueness reasoning as above), so a second "create" call updates the existing plan instead.
**Notes**: deliberately a **separate model from `TeachingUnit`** — the planned total is a standalone target, independent of how many `TeachingUnit` rows currently exist, and can be entered before any exist at all. `unitLabel` is a plain, unvalidated string — the mechanism for supporting "Unit" or "Chapter" terminology without a second model.

### `TeachingUnit`
**Purpose**: one curriculum unit/chapter under a subject offering, with a teaching-progress status. **Currently used**: yes.
**Key fields**: `id, gradeSubjectId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK to Section), subjectId (FK), title, order, status (default "NOT_STARTED"), startedAt?, completedAt?, createdByUserId (FK), createdAt, updatedAt`. Valid `status`: `NOT_STARTED | IN_PROGRESS | COMPLETED`.
**Constraints**: none beyond FKs — `order` is app-assigned (current count in its `(gradeSubjectId, sectionId)` scope + 1), deliberately not a DB unique constraint (same NULL-in-unique-index reasoning as elsewhere in this schema).
**Delete behavior**: cascades from `GradeSubject`; no delete route.
**Notes**: `sectionId: null` = a grade-wide unit sequence shared by every section; a real value = that section's own, independent sequence. Status transitions manage `startedAt`/`completedAt` automatically (see [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md)).

### `UnitTest`
**Purpose**: a test tied to one `TeachingUnit`. **Currently used**: yes.
**Key fields**: `id, unitId (FK), title, testDate, maxMarks, createdByUserId (FK), createdAt`.
**Constraints**: none — multiple tests per unit are allowed.
**Delete behavior**: cascades from `TeachingUnit`; no delete route.
**Notes**: creatable only when the parent unit's `status` is `IN_PROGRESS` or `COMPLETED` — a route-level rule, not a schema constraint.

### `UnitTestResult`
**Purpose**: one student's evaluation for one `UnitTest`. **Currently used**: yes.
**Key fields**: `id, unitTestId (FK), studentId (FK), status (default "PENDING"), marksObtained?, remarks?, evaluatedByUserId?, evaluatedAt?`. Valid `status`: `PENDING | EVALUATED | ABSENT`.
**Constraints**: `@@unique([unitTestId, studentId])`.
**Delete behavior**: cascades from `UnitTest`/`Student`; no delete route — rows are pre-created for the test's roster at creation time, only ever updated afterward.
**Notes**: pre-created (`status: "PENDING"`) for every student enrolled in the test's scope (via `GradeHistory`) when the `UnitTest` is created — a stable roster snapshot. `status: "ABSENT"` forces `marksObtained` to `null`; `status: "EVALUATED"` requires `marksObtained` between `0` and the test's `maxMarks`.

---

## Teacher Qualitative Evaluation & Parent-Teacher Meetings — Phase 3C ✅ (fully implemented and in active use)

Two new models, additive on top of Phase 2/3A/3B — no existing model's columns changed, only new relation-array fields. See [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md) for the full behavioral write-up; this section covers structure only.

### `StudentEvaluation`
**Purpose**: a teacher's narrative, qualitative evaluation of one student, for one session — General (`gradeSubjectId: null`, Class/Section Teacher) or Subject (`gradeSubjectId` set, Subject Teacher). **Currently used**: yes.
**Key fields**: `id, studentId (FK), teacherId (FK), academicSessionId (FK), schoolGradeId (FK), sectionId? (FK), gradeSubjectId? (FK), remarks, visibleToParent (default false), sharedWithParentAt?, visibleToStudent (default false), sharedWithStudentAt?, createdByUserId (FK), createdAt, updatedAt`.
**Constraints**: `@@unique([studentId, teacherId, academicSessionId, gradeSubjectId])` — reliably catches an exact duplicate subject-specific slot; does **not**, by itself, catch a second general (`gradeSubjectId: null`) evaluation from the same teacher/student/session (the familiar `NULL ≠ NULL` unique-index gap already seen with `TeacherAcademicAssignment`/`ClassTeacherAssignment`) — the create route pre-checks this case explicitly.
**Delete behavior**: cascades from `Student`; no delete route — remarks are edited in place via `updateEvaluationRemarks()`, never deleted and recreated.
**Notes**: `visibleToParent`/`visibleToStudent` are two fully independent gates — sharing with one audience never affects the other, verified live. `remarks` is freely editable while both flags are `false`; once either is `true`, every subsequent edit is routed through `updateEvaluationRemarks()` (`src/lib/evaluation.ts`), which pairs the update with a `StudentEvaluationAudit` row in the same transaction. Sharing itself (`shareEvaluation()`) is one-way — no un-share path exists.

### `StudentEvaluationAudit`
**Purpose**: append-only correction log for `StudentEvaluation`, written only once an evaluation has been shared with a Parent and/or a Student. **Currently used**: yes.
**Key fields**: `id, evaluationId (FK), changedByUserId (FK), changedAt, previousRemarks, newRemarks`.
**Constraints**: none beyond FKs.
**Delete behavior**: cascades from `StudentEvaluation`; no update or delete route ever touches this table — `updateEvaluationRemarks()` is the sole writer and only ever inserts, and only when the evaluation was already shared at the time of the edit.
**Notes**: unlike `GradeHistoryAudit`/`AttendanceAudit` (audited from the very first write), this table is deliberately silent while an evaluation is still a private draft — verified live: 0 audit rows after a private edit, exactly 1 after the first edit following a share action.

### `ParentTeacherMeeting`
**Purpose**: a scheduled meeting between one `Teacher` and one `Student`'s parent(s) — covers both periodic (bulk-scheduled) and occasional (single) meetings through the same rows. **Currently used**: yes.
**Key fields**: `id, schoolId (FK), academicSessionId (FK), studentId (FK), teacherId (FK), gradeSubjectId? (FK), scheduledAt, location?, onlineUrl?, status (default "SCHEDULED"), outcomeNotes?, linkedEvaluationId? (FK to StudentEvaluation), createdByUserId (FK), createdAt, updatedAt`. Valid `status`: `SCHEDULED | COMPLETED | CANCELLED`.
**Constraints**: none beyond FKs — no uniqueness constraint blocks multiple meetings for the same student/teacher (a follow-up meeting is expected).
**Delete behavior**: cascades from `Student`; no delete route — a meeting is cancelled (`status: "CANCELLED"`), never deleted.
**Notes**: `linkedEvaluationId` is a plain (non-unique) FK — many meetings may reference the same evaluation. **Parent-visible only in this phase** — `fetchParentMeetings()` (`dashboard/page.tsx`) is called exclusively from the Parent branch; there is no code path where a Student's own page render ever queries this table, a structural guarantee rather than a hidden UI section. `outcomeNotes` is not audited (only `StudentEvaluation.remarks` has that requirement) — freely editable, current-state data.

---

## Organizations

### `Organization` ✅
**Purpose**: a verified, listed education organization that can publish MEGA Academy courses. **Currently used**: yes.
**Key fields**: `id, name, slug (unique), description?, website?, verified (default false), isActive (default true)`.
**Delete behavior**: no delete route exists.
**Notes**: ⚠️ **no `logoUrl` field exists at all** — unlike `School`, an organization has no way to have a logo in the schema today. `isActive` has the same "read but never set" characteristic as `School.isActive`.

### `OrganizationAdmin` / `OrganizationAccountant` ✅
Same shape and behavior as `SchoolAdmin`/`SchoolAccountant`. `@@unique([userId, organizationId])` each.

---

## Educational Approaches ✅

`EducationalApproach` (e.g. "STEM", "Montessori") and `SchoolApproach` (join table, `@@unique([schoolId, approachId])`) — simple tagging, cross-cutting schools, courses, and resources. Currently used.

---

## MEGA Academy — courses, enrollment, certificates ✅

### `Course`
**Purpose**: a MEGA Academy course. **Currently used**: yes.
**Key fields**: `id, organizationId?, approachId?, instructorId?, title, slug (unique), description?, priceCents (default 0), published (default false)`.
**Delete behavior**: no delete route exists.
**Notes**: `organizationId` is technically optional in the schema, but every real creation path requires an org admin. No "course bundle" or "premium tier" concept exists anywhere — see [PRODUCT_RULES.md](PRODUCT_RULES.md).

### `CourseModule`, `Lesson` ✅
Ordered content under a course. Cascades from `Course`/`CourseModule` respectively.

### `CourseEnrollment` ✅
**Purpose**: one learner's enrollment in one course. **Currently used**: yes.
**Key fields**: `id, courseId (FK), teacherId?, studentId?, progress (default 0), completedAt?, enrolledAt`. Either `teacherId` or `studentId` is set, never neither.
**Delete behavior**: cascades from `Course`. Has an optional 1:1 `certificate`.

### `Certificate` ✅
**Purpose**: a dynamically-generated, verifiable credential. **Currently used**: yes, issued automatically on course completion.
**Key fields**: `id, verificationCode (unique), recipientUserId (FK), enrollmentId? (unique FK), gradeHistoryId? (unique, reserved for Phase 2 — no live Prisma relation declared), instructorId? (FK), issuerType, issuerOrganizationId? (FK), issuerSchoolId? (FK), associatedSchoolId? (FK), title, recipientNameSnapshot, recipientMegaIdSnapshot, issuerNameSnapshot, associatedSchoolNameSnapshot?, instructorNameSnapshot?, issuedAt`. Valid `issuerType`: `MEGA_EDU | ORGANIZATION | SCHOOL | JOINT` (only `ORGANIZATION` is reachable today).
**Delete behavior**: no delete route — certificates are permanent records.
**Notes**: full design rationale in [CERTIFICATES.md](CERTIFICATES.md).

### `Instructor` ✅
**Purpose**: a course/certificate instructor, deliberately decoupled from `User`. **Currently used**: yes.
**Key fields**: `id, name, megaIdUserId? (unique FK)`. Can be named with no MEGA ID at all ("Shown on certificates issued for this course. If they later get a MEGA ID, their record can be linked to it.").

---

## Identity layer — Interests & Skills ✅

### `Interest`
**Purpose**: a user's self-declared interests. **Currently used**: yes.
**Constraints**: `@@unique([userId, name])`. Self-managed by any user.
**Delete behavior**: cascades from `User`.

### `Skill`
**Purpose**: a skill credited to a student by a teacher/school-admin. **Currently used**: yes.
**Key fields**: `id, studentId (FK), addedByUserId (FK), name, createdAt`.
**Constraints**: `@@unique([studentId, addedByUserId, name])` — prevents the *same person* crediting the *same skill* to the *same student* twice, while different people independently crediting the same skill is fully allowed (each is a separate row). See [PRODUCT_RULES.md](PRODUCT_RULES.md).
**Delete behavior**: cascades from `Student`. The creation route catches the resulting `P2002` and returns `{ok: true, alreadyExists: true}` rather than an error.

**Interest vs. Skill, in one line**: an `Interest` is self-declared and belongs to any `User`; a `Skill` is teacher-attested and belongs specifically to a `Student`, crediting who added it.

---

## Resources, Events, Opportunities ✅

`Resource`, `Event`, `Opportunity` — optionally attached to a `School` and/or `Organization` (both nullable FKs). No approval/moderation workflow — posting is publishing.

---

## Subscriptions & Payments 🟡 (modeled, not integrated)

`Subscription` (`id, userId?, schoolId?, plan, status (default "ACTIVE"), startedAt, endsAt?`) and `Payment` (`id, userId?, subscriptionId?, amountCents, currency (default "NPR"), status (default "PENDING"), provider?, providerRef?`) are fully modeled in the schema but **no payment processor is integrated**. `AccountantDashboard.tsx` tells Accountant-role users plainly that real payment processing isn't built yet. Course enrollment for a priced course (`priceCents > 0`) is explicitly blocked with an error rather than attempting a charge.

---

## Notifications ✅

`Notification` — `id, userId (FK), type, title, body?, read (default false)`. Written only through `notify()`/`notifySchoolCommunity()` (`src/lib/notify.ts`), never directly. Current `type` values in use: `SCHOOL_ANNOUNCEMENT, STAFF_APPROVED, STUDENT_APPROVED, CERTIFICATE_ISSUED, SCHOOL_VERIFIED, ORGANIZATION_VERIFIED`.

---

## Cross-cutting decisions

- **Snapshot fields for anything that must survive a later rename**: `Certificate.*NameSnapshot`, `GradeHistoryAudit.previous/newOutcomeGradeId`. Logos are the deliberate exception (live-looked-up). Full rationale: [PRODUCT_RULES.md](PRODUCT_RULES.md).
- **`Student.gradeLevel` is permanent legacy fallback**, not scheduled for removal.
- **No cascading deletes on cross-reference relations** (e.g. `GradeHistory.schoolGradeId`, `Certificate.issuerOrganizationId`) — only genuine ownership chains cascade.
- **Most models in this schema have no working delete route in the application** — for those, every "delete behavior" described above is schema-level cascade behavior that would apply *if* a delete ever happened, not something any current UI action triggers. The exceptions, all deliberate: `TeacherGradeAssignment`, `GradeSubject`, `TeacherAcademicAssignment`, and `ClassTeacherAssignment` each have a real `DELETE` route — all four are current-state, non-historical operational data (never audited, freely re-creatable), not permanent records. `Attendance` corrections go through an audited update (`correctAttendance()`) instead of a delete-and-recreate — the row itself is never deleted, only its `status`/`remarks` change, each change logged in `AttendanceAudit`.
