# API Reference

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-10 (Parent-Student Linking Trust Boundary kilometer), against the current codebase — every route below exists in `src/app/api/**/route.ts` as documented. This is a complete inventory; nothing here is invented.

All routes are ✅ implemented. "Auth" means the caller must be logged in (`getServerSession`). "Authz" is the specific `requireX` helper (see [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)) or inline check used, if any beyond plain login. Response bodies are JSON; a successful response generally includes `{ ok: true, ... }`, an error `{ error: string }`.

## Authentication & Registration

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler (sign in/out, session, CSRF) | — | — | Standard NextAuth internals |
| `POST` | `/api/auth/register` | Generic single-role registration | — | — | `{name, email, password, role}`, role is one of `STUDENT`, `TEACHER`, `PARENT`, `SCHOOL_ADMIN`, `ORGANIZATION_ADMIN`. `409` if email exists. Teacher/Student/Parent get an unaffiliated profile created immediately |
| `POST` | `/api/auth/register-teacher` | Teacher registration + school affiliation in one step | — | — | Requires `schoolId` of an **already-verified** school; `400` otherwise |
| `POST` | `/api/auth/register-student` | Student registration + school affiliation | — | — | Same verified-school requirement |
| `POST` | `/api/auth/register-parent` | Parent registration + request to link to an existing child | — | — | Requires `childEmail` to already belong to a `Student`; `400` if not found. Creates the `ParentStudent` row with `confirmedAt: null` — no protected access until the Student confirms (see [PARENT_STUDENT_LINKING.md](PARENT_STUDENT_LINKING.md)) |
| `POST` | `/api/auth/register-organization` | Organization Admin registration + org creation in one step | — | — | Slugifies `orgName`, appends a random suffix on collision |

## Post-registration affiliation

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/teacher/join-school` | JOIN — creates a new `PENDING` `TeacherSchoolAffiliation` | ✅ | inline (own `Teacher` row) | Resets `approved: false`; does not touch any other affiliation the teacher already has elsewhere |
| `POST` | `/api/teacher/leave-school` | LEAVE — ends the teacher's current `ACTIVE` affiliation at a school | ✅ | inline (own `Teacher` row) | `status → ENDED`, `endDate` set to now; other affiliations at other schools untouched |
| `POST` | `/api/teacher/transfer-school` | TRANSFER — ends the old affiliation and creates a new `PENDING` one atomically | ✅ | inline (own `Teacher` row) | Single transaction; throws `AffiliationError` (never returns `{error}`) so a failure can never leave a half-applied transfer |
| `POST` | `/api/student/join-school` | JOIN — creates a new `PENDING` `StudentSchoolAffiliation` | ✅ | inline | Resets `approved: false` |
| `POST` | `/api/student/leave-school` | LEAVE — ends the student's current `ACTIVE` affiliation at a school | ✅ | inline | `status → ENDED`, `endDate` set to now |
| `POST` | `/api/student/transfer-school` | TRANSFER — ends the old affiliation and creates a new `PENDING` one atomically | ✅ | inline | Same atomic-with-rollback shape as the teacher route above |
| `POST` | `/api/parent/link-child` | Request to link an additional child by email | ✅ | inline (own `Parent` row) | Idempotent — never resets an existing row; `alreadyLinked: true` if already confirmed, `alreadyRequested: true` if already pending. Creates with `confirmedAt: null` — see [PARENT_STUDENT_LINKING.md](PARENT_STUDENT_LINKING.md) |
| `POST` | `/api/parent-student/[id]/confirm` | Student confirms a pending `ParentStudent` request | ✅ | inline (caller must be the row's own Student) | Sets `confirmedAt: now()`; idempotent (`alreadyConfirmed: true`); `403` for any other user, `404` if the row doesn't exist |
| `DELETE` | `/api/parent-student/[id]` | Decline (pending) or unlink (confirmed) — one hard delete | ✅ | inline (caller must be the row's Parent or Student) | `403` for any unrelated user, including School/Organization Admins; `404` if the row doesn't exist |
| `POST` | `/api/schools/create-for-admin` | Create a school for an already-registered `SCHOOL_ADMIN` role holder with no school yet | ✅ | inline (`roles.includes`) | `409` if already administers one |
| `POST` | `/api/organizations/create-for-admin` | Same, for `ORGANIZATION_ADMIN` | ✅ | inline | `409` if already administers one |
| `POST` | `/api/schools/register` | Alternate school+admin creation path | — | — | Same shape as `register-organization` for schools |

## Platform Admin

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/admin/schools/[id]/verify` | Verify a school | ✅ | `requirePlatformAdmin` | Sets `verified: true`, notifies school admins |
| `POST` | `/api/admin/organizations/[id]/verify` | Verify an organization | ✅ | `requirePlatformAdmin` | Sets `verified: true`, notifies org admins |

## Schools — directory & profile

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/schools/search` | Public school search (typeahead) | — | — | Filters `verified: true, isActive: true`; max 20 results |
| `PATCH` | `/api/schools/[id]` | Update school profile fields | ✅ | `requireSchoolAdmin` | `description, contactEmail, contactPhone, location, gradesOffered` |
| `POST` | `/api/schools/[id]/programs` | Add a program | ✅ | `requireSchoolAdmin` | `{name, description}` |
| `POST` | `/api/schools/[id]/news` | Post a news item | ✅ | `requireSchoolAdmin` | Fires `notifySchoolCommunity()` (best-effort) |
| `POST` | `/api/schools/[id]/opportunities` | Post an opportunity | ✅ | `requireSchoolAdmin` | `{title, description, type, deadline?, applyUrl?}` |
| `GET`/`POST` | `/api/schools/[id]/accountants` | List / grant School Accountant access | ✅ | `requireSchoolAdmin` | `POST` by email; auto-adds `ACCOUNTANT` role if missing; `404` if no MEGA ID with that email, `alreadyGranted: true` if already linked |
| `DELETE` | `/api/schools/[id]/accountants/[userId]` | Revoke School Accountant access | ✅ | `requireSchoolAdmin` | Deletes only the `SchoolAccountant` join row — never the User, School, or global `ACCOUNTANT` role flag; `404` if no such grant exists at this school |

## Schools — staff & students

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/schools/[id]/students` | List approved students + skills | ✅ | inline (approved teacher **or** admin at this school) | Not scoped by grade — any approved teacher sees the whole roster |
| `POST` | `/api/schools/[id]/students` | **Add Student** — School Admin directly creates a Student MEGA ID | ✅ | `requireSchoolAdmin` | `{name, email, password, academicSessionId?, schoolGradeId?, sectionId?}`; `409` if the email already exists. `approved: true` immediately (nothing to vet — the admin is the creator). Grade/section are optional; if `schoolGradeId` is given, `academicSessionId` is required and both (plus `sectionId`, if given — must be `isActive` and belong to that grade) are validated **before** any row is created, so a rejected request never leaves a half-created account. When a valid grade is given, inserts a first `GradeHistory` row inline in the same transaction — direct creation (`status: "ENROLLED"`), same shape as `grade-placements` below but **not** a call to that route. `Student.gradeLevel` is left `null` (the legacy fallback is for self-registration only) |
| `POST` | `/api/schools/[id]/teachers` | **Add Teacher** — School Admin directly creates a Teacher/Staff MEGA ID | ✅ | `requireSchoolAdmin` | `{name, email, password, position?, subjects?}`; `409` if the email already exists. `approved: true` immediately. Creates `User` + `Teacher` only — deliberately touches no academic assignment table (`TeacherGradeAssignment`/`TeacherAcademicAssignment`/`ClassTeacherAssignment`); those remain a separate later step through the existing Phase 3A/3B UI, unchanged by this route |
| `POST` | `/api/schools/[id]/teachers/[teacherId]/approve` | Approve a pending teacher | ✅ | `requireSchoolAdmin` | Sends `STAFF_APPROVED` notification |
| `POST` | `/api/schools/[id]/students/[studentId]/approve` | Approve a pending student | ✅ | `requireSchoolAdmin` | Sends `STUDENT_APPROVED` notification |
| `POST` | `/api/schools/[id]/students/[studentId]/skills` | Credit a student with a skill | ✅ | inline (approved teacher **or** admin at the student's own school) | Catches `P2002` → `{ok: true, alreadyExists: true}` instead of an error |

## Schools — Academic Sessions & Grades (Phase 2)

All gated by `requireSchoolAdmin(id)`. See [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) and [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) for full behavioral detail — this table is structural.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/academic-sessions` | Create the first (or only) session | `{name, startDate, endDate}` | `alreadyActive: true` (HTTP 200, no-op) if an `ACTIVE` session already exists — not an error |
| `POST` | `/api/schools/[id]/academic-sessions/rollover` | Close current session, open a new one, sweep eligible students forward | `{name, startDate, endDate}` | `400` if no `ACTIVE` session exists to close; response includes `placed: <count>` |
| `POST` | `/api/schools/[id]/grades` | Bulk upsert `SchoolGrade` selection/display names | `{grades: [{gradeReferenceId, displayName}]}` | Additive-only, never deletes an existing `SchoolGrade` |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/sections` | Bulk-create `Section`s under one grade | `{names: string[]}` | Trims/dedupes input; an existing-name collision is caught per-name inside a transaction and silently skipped (not an error) |
| `PATCH` | `/api/schools/[id]/sections/[sectionId]` | Rename and/or activate/deactivate a section | `{name?, isActive?}` | `409 {"error": "Another section in this grade already has that name."}` on a rename collision; no `DELETE` route exists — see [PRODUCT_RULES.md](PRODUCT_RULES.md) |
| `POST` | `/api/schools/[id]/teacher-assignments` | Bulk-create teacher→grade assignments for one session | `{academicSessionId, assignments: [{teacherId, schoolGradeId}]}` | One transaction; invalid/foreign ids and duplicates silently counted in `skipped`, not errored |
| `DELETE` | `/api/schools/[id]/teacher-assignments/[assignmentId]` | Remove one assignment | — | `404` if not found or wrong school |
| `POST` | `/api/schools/[id]/grade-placements` | Bulk-create first-time `GradeHistory` rows | `{academicSessionId, placements: [{studentId, schoolGradeId, sectionId?}]}` | Direct creation, **not** `recordGradeDecision()`; one transaction; duplicates counted in `skipped`. `sectionId` is optional — if given, must be an active section belonging to the same `schoolGradeId`, or that placement is skipped (not errored). Called from three UI surfaces sharing this one route: Initial Setup step 6 (bulk), the Pending/Unresolved queue's manual placement (bulk), and the Students tab's per-student **"Assign Grade & Section →"** action (single-item `placements` array) for any approved student — including one created via **Add Student** with no grade — who has no `GradeHistory` row for the active session yet |
| `POST` | `/api/schools/[id]/grade-decisions` | Bulk-apply a Promotion decision | `{gradeHistoryIds: string[], status: "COMPLETED, REPEATED, TRANSFERRED, or LEFT", outcomeSchoolGradeId?}` | Every row routed through `recordGradeDecision()` inside one transaction; ineligible ids (wrong school, already decided) pre-filtered and counted in `skipped`; `400` if zero ids are eligible. Never reads or writes `sectionId` |
| `POST` | `/api/schools/[id]/section-assignments` | Bulk-reassign the section on existing `GradeHistory` rows | `{gradeHistoryIds: string[], sectionId: string \| null}` | Every row routed through `reassignSection()` inside one transaction (audited); `400` if the target section is deactivated or belongs to a different grade than a targeted row |
| `POST` | `/api/schools/[id]/grade-rollover` | On-demand re-run of the carry-forward sweep against the current session | — | `400` if no `ACTIVE` session; idempotent — re-running with nothing new to place returns `placed: 0`, never an error. Carried-forward rows always have `sectionId: null` |

## Schools — Subjects & Teacher Academic Assignment (Phase 3A)

All gated by `requireSchoolAdmin(id)`. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) for full behavioral detail — this table is structural.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/subjects` | Bulk-create the school's subject catalog | `{names: string[]}` | Additive-only; existing-name collisions silently skipped |
| `PATCH` | `/api/schools/[id]/subjects/[subjectId]` | Rename and/or activate/deactivate a subject | `{name?, isActive?}` | `409` on a rename collision; no `DELETE` route exists |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/subjects` | Bulk-opt a grade into subjects for ONE session | `{academicSessionId, subjectIds: string[]}` | Only active subjects accepted; existing offerings for this grade+session silently skipped |
| `DELETE` | `/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]` | Remove one subject from a grade's offering | — | `409` if a `TeacherAcademicAssignment` still references it — remove those first |
| `POST` | `/api/schools/[id]/teacher-academic-assignments` | Bulk-create teacher subject-teaching assignments for one session | `{academicSessionId, assignments: [{teacherId, schoolGradeId, sectionId?, subjectId}]}` | `sectionId: null` = grade-wide; subject must be offered at that grade this session (via `GradeSubject`) or the item is skipped; the same teacher can't hold both a grade-wide and section-specific row for the same subject/grade/session (skipped, not errored) — see [PRODUCT_RULES.md](PRODUCT_RULES.md) |
| `DELETE` | `/api/schools/[id]/teacher-academic-assignments/[assignmentId]` | Remove one teacher academic assignment | — | `404` if not found or wrong school |

## Schools — School Academic Operations (Phase 3B)

Auth: `requireSchoolAdmin(id)` OR the specific `requireClassTeacher`/`requireTeacherAssignment` scope noted per route — see [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md) for full behavioral detail; this table is structural.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/class-teacher-assignments` | Bulk-create Grade Coordinator / Class Teacher assignments | `{academicSessionId, assignments: [{teacherId, schoolGradeId, sectionId?}]}` | No overlap rule (grade-wide and section-specific may coexist); an already-filled slot is silently skipped |
| `DELETE` | `/api/schools/[id]/class-teacher-assignments/[assignmentId]` | Remove one Grade Coordinator/Class Teacher assignment | — | `404` if not found or wrong school |
| `POST` | `/api/schools/[id]/attendance` | Bulk-mark attendance for one date | `{academicSessionId, schoolGradeId, sectionId?, date: "YYYY-MM-DD", records: [{studentId, status, remarks?}]}` | Auth: `requireSchoolAdmin` OR `requireClassTeacher` scoped to `sectionId` (omitted = whole grade, requires a Grade Coordinator). A student whose actual `GradeHistory` placement doesn't match the target is skipped; an already-marked student for that date is skipped, not erroneous |
| `PATCH` | `/api/schools/[id]/attendance/[attendanceId]` | Correct an already-marked day's status/remarks | `{status?, remarks?}` | Audited via `correctAttendance()` — inserts an `AttendanceAudit` row every time, capturing both fields even if only one changed. Auth scope resolved from the record itself, not client input |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/teaching-plan` | Set or update the planned-total/display-label plan for one scope | `{sectionId?, plannedTotal, unitLabel?}` | Find-or-update-else-create — never a duplicate row per `(gradeSubjectId, sectionId)` |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/units` | Create one TeachingUnit (Unit/Chapter) | `{sectionId?, title}` | `order` auto-assigned (current count in scope + 1) |
| `PATCH` | `/api/schools/[id]/units/[unitId]` | Update a unit's title and/or teaching-progress status | `{title?, status?}` | Status transitions manage `startedAt`/`completedAt` automatically |
| `POST` | `/api/schools/[id]/units/[unitId]/tests` | Create a Unit/Chapter Test | `{title, testDate, maxMarks}` | `400` if the unit is still `NOT_STARTED`; pre-creates a `PENDING` `UnitTestResult` row for every enrolled student in the unit's scope |
| `PATCH` | `/api/schools/[id]/tests/[unitTestId]/results` | Bulk-record student evaluations | `{results: [{studentId, status, marksObtained?, remarks?}]}` | `status: "ABSENT"` forces `marksObtained: null`; `status: "EVALUATED"` requires `0 ≤ marksObtained ≤ maxMarks`, otherwise skipped |

## Schools — Homework (Phase 1)

| Method | Path | Purpose | Body | Notes |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/homework` | Create one `DRAFT` Homework item | `{schoolGradeId, sectionId?, gradeSubjectId, title, instructions, dueDate}` | Teacher-only (`requireTeacherAssignment()`, not composed with `requireSchoolAdmin()`) — `teacherId` resolved server-side from the session, never client-supplied; every relational id re-validated against the URL's school |
| `PATCH` | `/api/schools/[id]/homework/[homeworkId]` | Edit `DRAFT` fields and/or publish | `{title?, instructions?, dueDate?, sectionId?, status?}` | School Admin or the assigned Teacher, re-verified against the homework's own stored scope; `409` if editing fields on an already-`PUBLISHED` item; `DRAFT → PUBLISHED` is idempotent |

## Schools — Calendar, School Events (Kilometer 1)

| Method | Path | Purpose | Body | Notes |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/events` | Create a School Event | `{title, description?, date, time?, isAllDay, location?, onlineUrl?}` | School-Admin-only, mirrors `/api/schools/[id]/opportunities`'s exact shape; `createdByUserId` resolved server-side; `organizationId` is never accepted from the client |
| `PATCH` | `/api/schools/[id]/events/[eventId]` | Edit and/or deactivate an Event | `{title?, description?, date?, time?, isAllDay?, location?, onlineUrl?, isActive?}` | School-Admin-only; re-verifies the Event's own `schoolId` against the URL's school (defense in depth against a forged cross-school `eventId`); no `DELETE` route — `isActive: false` is the only removal path, the record is never dropped |

## Schools — SchoolCalendarEntry (Kilometer 1.1)

| Method | Path | Purpose | Body | Notes |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/school-calendar` | Create a SchoolCalendarEntry | `{title, category, description?, date}` (point categories) or `{title, category, description?, startDate, endDate}` (range categories) | School-Admin-only; `affectsDayStatus` is derived from `category` server-side (`resolveSchoolCalendarEntryDates()`) and is **never** read from the request body, even if supplied; rejects a range category missing `startDate`/`endDate`, a point category missing `date`, or `startDate > endDate` |
| `PATCH` | `/api/schools/[id]/school-calendar/[entryId]` | Edit and/or deactivate a SchoolCalendarEntry | `{title?, category?, description?, date?, startDate?, endDate?, isActive?}` | School-Admin-only; re-verifies the entry's own `schoolId` against the URL's school; changing `category` (or any date field) re-validates and re-derives `affectsDayStatus`; no `DELETE` route |

No API route exists for reading Calendar data — every Calendar page (`/calendar`, `/dashboard/calendar`, `/dashboard/schools/[id]/calendar`) queries its own already-authorized sources directly via server components, the same convention every other Phase 3 config/results page already follows.

## Schools — Teacher Qualitative Evaluation & Parent-Teacher Meetings (Phase 3C)

Auth: `requireSchoolAdmin(id)` OR the specific `requireClassTeacher`/`requireTeacherAssignment` scope noted per route — see [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md) for full behavioral detail; this table is structural.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/students/[studentId]/evaluations` | Create a General (`gradeSubjectId` omitted) or Subject (`gradeSubjectId` set) qualitative evaluation | `{teacherId?, gradeSubjectId?, remarks}` | Auth: `requireTeacherAssignment` (subject set) or `requireClassTeacher` (general) for the acting teacher, OR `requireSchoolAdmin` with a validated `teacherId` in the body. `409` if this teacher already has an evaluation for this student/session/scope — explicit app-level pre-check for the `gradeSubjectId: null` NULL-uniqueness gap |
| `PATCH` | `/api/schools/[id]/evaluations/[evaluationId]` | Edit `remarks` and/or share with Parent/Student | `{remarks?, share?: "PARENT" \| "STUDENT"}` | Remarks edits go through `updateEvaluationRemarks()` — silent while private, inserts a `StudentEvaluationAudit` row once shared with either audience. Sharing is one-way (no un-share) |
| `POST` | `/api/schools/[id]/meetings` | Bulk-schedule Parent-Teacher Meetings — one item for occasional, many for periodic | `{meetings: [{studentId, teacherId?, gradeSubjectId?, scheduledAt, location?, onlineUrl?}]}` | Every item resolved/validated before the transaction opens (Postgres-safe pattern, not the SQLite-only catch-mid-transaction one); ineligible items silently counted in `skipped` |
| `PATCH` | `/api/schools/[id]/meetings/[meetingId]` | Update status/outcomeNotes/linkedEvaluationId, and/or reschedule (scheduledAt/location/onlineUrl) | `{status?, outcomeNotes?, linkedEvaluationId?, scheduledAt?, location?, onlineUrl?}` | Auth by identity — `requireSchoolAdmin` OR specifically the (still-`approved`) teacher the meeting's own `teacherId` names, not re-derived scope. `linkedEvaluationId` validated to belong to the same student. Any of `scheduledAt`/`location`/`onlineUrl` present triggers reschedule handling — `400` unless the meeting is still `SCHEDULED`; not audited |

## Schools — Assessment Framework Foundation (Phase 3D-1)

Auth: `requireSchoolAdmin(id)` only — no teacher-facing write route exists in this phase. See [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md) for full behavioral detail; this table is structural. No `GET` list routes exist — every read happens through `/dashboard/assessment-frameworks`'s own direct Prisma queries.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/grading-scales` | Create a reusable GradingScale with its bands, nested in one request | `{name, bands: [{minPercent, maxPercent, label, gradePoint?, description?}]}` | `400` if any band is malformed or bands overlap; `409` on a duplicate scale name at this school |
| `PATCH` | `/api/schools/[id]/grading-scales/[gradingScaleId]` | Rename, activate/deactivate, and/or fully replace a scale's bands | `{name?, isActive?, bands?}` | Passing `bands` deletes and recreates the full set atomically — bands have no independent identity referenced elsewhere in this phase. **Locked (`409`)** once any `PUBLISHED` result exists using this scale (via any framework attached to it) — `name`/`isActive` remain editable at any time. No `DELETE` route — deactivate only |
| `POST` | `/api/schools/[id]/assessment-frameworks` | Create a reusable AssessmentFramework, optionally with periods and components nested in one request | `{name, description?, gradingScaleId?, periods?: string[], components?: [{name, maxMarks, entryMode?, periodName?}]}` | `400` on an invalid `entryMode`, an undeclared `periodName` reference, or a duplicate component name within the same request; `409` on a duplicate framework name at this school |
| `PATCH` | `/api/schools/[id]/assessment-frameworks/[frameworkId]` | Rename, redescribe, re-scale, and/or activate/deactivate a framework | `{name?, description?, gradingScaleId?, isActive?}` | No `DELETE` route — deactivate only. Structural edits are unrestricted in this phase (no marks exist yet to invalidate) |
| `POST` | `/api/schools/[id]/assessment-frameworks/[frameworkId]/periods` | Add one period to an existing framework | `{name}` | `order` auto-assigned (current count in the framework); `409` on a duplicate period name within the framework |
| `PATCH`/`DELETE` | `/api/schools/[id]/assessment-frameworks/[frameworkId]/periods/[periodId]` | Rename / remove a period | `{name}` (PATCH only) | `DELETE` cascades the period's own components. Not audited — current-state config |
| `POST` | `/api/schools/[id]/assessment-frameworks/[frameworkId]/components` | Add one component to an existing framework, optionally nested under a period | `{name, maxMarks, entryMode?, periodId?}` | Duplicate-name protection is an explicit pre-check (`componentCollisionExists`), not just the DB constraint — see the NULL≠NULL note in [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md); `409` on collision |
| `PATCH`/`DELETE` | `/api/schools/[id]/assessment-frameworks/[frameworkId]/components/[componentId]` | Rename/re-weight/re-mode, or remove, a component | `{name?, maxMarks?, entryMode?}` (PATCH only) | Not audited — current-state config, real `DELETE` route. **`maxMarks`/`entryMode` locked (`409`) once any `AssessmentComponentResult` exists** — renaming stays free; `DELETE` is blocked (`409`) under the same condition |
| `POST` | `/api/schools/[id]/assessment-framework-assignments` | Bind a framework to `(academicSession, schoolGrade)`, optionally narrowed to one `gradeSubject` as a subject override | `{academicSessionId, schoolGradeId, gradeSubjectId?, frameworkId}` | Resolution priority (override before default) documented in [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md). Duplicate protection is an explicit pre-check (`assignmentCollisionExists`); `409` on collision for either the grade-default or the subject-override case |
| `DELETE` | `/api/schools/[id]/assessment-framework-assignments/[assignmentId]` | Remove one assignment | — | Not audited — current-state config, same as `TeacherAcademicAssignment`'s own `DELETE` route. **Blocked (`409`)** if any `AssessmentComponentResult`/`AssessmentResultPublication` references it |

## Schools — Assessment Results, Publishing, Report Cards (Phase 3D-2/3/4)

Auth: `requireSchoolAdmin(id) || requireTeacherAssignment(id, {..., subjectId})`, `subjectId` always resolved from the actual `gradeSubjectId` being assessed — see [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md) for full behavioral detail; this table is structural. No `GET` list routes exist — reads go through `/dashboard/assessment-results`/`/dashboard/report-card/[studentId]`'s own direct Prisma queries (via `fetchAssessmentResults()`/`buildReportCard()`, `src/lib/assessmentResults.ts`).

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `PATCH` | `/api/schools/[id]/assessment-framework-assignments/[assignmentId]/components/[componentId]/results` | Bulk-create/update results for one component — lazy, never pre-created | `{gradeSubjectId, results: [{studentId, status, marksObtained?, gradeLabel?, remarks?}]}` | Only students in the assignment's current `GradeHistory` roster are accepted; a student whose subject is already `PUBLISHED` is skipped (use the correction route instead). `ABSENT` clears marks/grade/remarks regardless of what's passed |
| `POST` | `/api/schools/[id]/assessment-framework-assignments/[assignmentId]/subjects/[gradeSubjectId]/publish` | Bulk-publish a subject's results — DRAFT -> PUBLISHED | `{studentIds?: string[]}` (omit for every eligible student) | Skips (never errors) any student with a still-`PENDING` non-`DESCRIPTIVE` component, or already published — completeness is computed server-side, not trusted from the client |
| `PATCH` | `/api/schools/[id]/assessment-results/[resultId]` | The audited correction path for an already-entered result | `{status, marksObtained?, gradeLabel?, remarks?}` | Plain update while the subject is still `DRAFT`; inserts an `AssessmentComponentResultAudit` row once `PUBLISHED` — the publication itself is never reverted to `DRAFT` |

## Organizations

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/organizations/[id]/courses` | Create a course | ✅ | `requireOrgAdmin` | Optional inline `Instructor` creation by name |
| `POST` | `/api/organizations/[id]/opportunities` | Post an opportunity | ✅ | `requireOrgAdmin` | Same shape as the school version |
| `GET`/`POST` | `/api/organizations/[id]/accountants` | List / grant Organization Accountant access | ✅ | `requireOrgAdmin` | Same pattern as the school version |

## Courses & Enrollment

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `PATCH` | `/api/courses/[courseId]` | Update course fields (including publish toggle) | ✅ | `requireCourseOwner` | Accepts any of `title, description, published, priceCents` |
| `POST` | `/api/courses/[courseId]/modules` | Add a module | ✅ | `requireCourseOwner` | `order` auto-set to current module count |
| `POST` | `/api/courses/[courseId]/modules/[moduleId]/lessons` | Add a lesson | ✅ | `requireCourseOwner` | `404` if module doesn't belong to the course |
| `POST` | `/api/courses/[courseId]/enroll` | Enroll the caller (as their Teacher or Student profile) | ✅ | inline (must have a `Teacher` or `Student` profile) | `404` if course not published; `400` if `priceCents > 0` (⚠️ paid enrollment not implemented); idempotent — `alreadyEnrolled: true` |
| `POST` | `/api/enrollments/[enrollmentId]/complete` | Mark an enrollment complete and issue a certificate | ✅ | inline (must own the enrollment) | One transaction: `progress: 100` + `issueCourseCertificate()`; idempotent — `alreadyCompleted: true` with the existing certificate |

## Identity layer

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/interests` | Add a self-declared interest | ✅ | inline (own `User`) | Idempotent — `alreadyExists: true` |
| `DELETE` | `/api/interests/[id]` | Remove an interest | ✅ | inline (must own it) | `404` if not owned |
| `GET`/`POST`/`DELETE` | `/api/user/avatar` | Read/upload/remove the caller's own MEGA ID photo | ✅ | inline (own `User`, `userId` from session only) | POST validates PNG/JPEG/WebP, ≤2MB; old file deleted only after the new one is saved and the DB row updated (never before) |
| `PATCH` | `/api/me/address` | Upsert the caller's own Current or Permanent address | ✅ | inline (own `User`, `userId` from session only) | `label` must be `CURRENT`/`PERMANENT`; validates the Province→District→LocalLevel→Ward chain (`src/lib/address.ts`); the same record a School Admin correcting this person's file (Student/Teacher detail pages) reads and writes, not a separate copy |
| `POST` | `/api/user/password` | Change the caller's own password | ✅ | inline (own `User`, `userId` from session only) | Requires current password (`bcrypt.compare`) + a new password ≥8 chars; **rejects demo accounts (`@megaedu.local`) with `403`, checked server-side before any hashing** — not merely hidden in the UI; touches only `User.passwordHash`, nothing else on `User`/`Teacher`/`Student`/`Parent`/any affiliation table |

My Profile (My Profile K1, `/dashboard/profile`) reads its "My Institutional Relationships" section directly via server-rendered Prisma queries scoped to the session's own `userId` — there is no dedicated API route for it, matching the same convention Calendar pages already use (see "No API route exists for reading Calendar data" above).

## Notifications

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/notifications/mark-read` | Mark all of the caller's notifications read | ✅ | inline | Bulk `updateMany` |
| `GET` | `/api/notifications/unread-count` | Unread badge count | — | — | Returns `{count: 0}` for a logged-out caller rather than erroring |

## Not implemented / not applicable

No routes exist for: deleting a `User`/`School`/`Organization`/`Course`/`Section`/`Subject`/`TeachingUnit`/`UnitTest`, deactivating a school/organization (`isActive` is read but never set by any route), section-level analytics/reporting, copying a `GradeSubject` offering or `TeachingPlan`/`TeachingUnit` set forward from a prior session (each session is configured from scratch, deliberately), teaching hierarchy (primary/assistant/substitute teacher, for either `TeacherAcademicAssignment` or `ClassTeacherAssignment`), retesting a `UnitTestResult`, examinations beyond Unit/Chapter Tests (Homework and Report Cards are both implemented — see "Schools — Homework" and "Schools — Assessment Results, Publishing, Report Cards" above), forgot-password/account recovery, analytics, payment processing, PDF certificate export, QR code generation, or grade-certificate issuance. See [KNOWN_GAPS.md](KNOWN_GAPS.md).
