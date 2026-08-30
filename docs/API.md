# API Reference

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30 (Phase 3C — Teacher Qualitative Evaluation & Parent-Teacher Meetings), against the current codebase — every route below exists in `src/app/api/**/route.ts` as documented. This is a complete inventory; nothing here is invented.

All routes are ✅ implemented. "Auth" means the caller must be logged in (`getServerSession`). "Authz" is the specific `requireX` helper (see [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)) or inline check used, if any beyond plain login. Response bodies are JSON; a successful response generally includes `{ ok: true, ... }`, an error `{ error: string }`.

## Authentication & Registration

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler (sign in/out, session, CSRF) | — | — | Standard NextAuth internals |
| `POST` | `/api/auth/register` | Generic single-role registration | — | — | `{name, email, password, role}`, role is one of `STUDENT`, `TEACHER`, `PARENT`, `SCHOOL_ADMIN`, `ORGANIZATION_ADMIN`. `409` if email exists. Teacher/Student/Parent get an unaffiliated profile created immediately |
| `POST` | `/api/auth/register-teacher` | Teacher registration + school affiliation in one step | — | — | Requires `schoolId` of an **already-verified** school; `400` otherwise |
| `POST` | `/api/auth/register-student` | Student registration + school affiliation | — | — | Same verified-school requirement |
| `POST` | `/api/auth/register-parent` | Parent registration + link to an existing child | — | — | Requires `childEmail` to already belong to a `Student`; `400` if not found |
| `POST` | `/api/auth/register-organization` | Organization Admin registration + org creation in one step | — | — | Slugifies `orgName`, appends a random suffix on collision |

## Post-registration affiliation

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/teacher/join-school` | Affiliate/re-affiliate a teacher with a school | ✅ | inline (own `Teacher` row) | Resets `approved: false` |
| `POST` | `/api/student/join-school` | Affiliate/re-affiliate a student | ✅ | inline | Resets `approved: false` |
| `POST` | `/api/parent/link-child` | Link an additional child by email | ✅ | inline (own `Parent` row) | Idempotent — `alreadyLinked: true` |
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
| `POST` | `/api/schools/[id]/class-teacher-assignments` | Bulk-create Grade Class Teacher / Section Teacher assignments | `{academicSessionId, assignments: [{teacherId, schoolGradeId, sectionId?}]}` | No overlap rule (grade-wide and section-specific may coexist); an already-filled slot is silently skipped |
| `DELETE` | `/api/schools/[id]/class-teacher-assignments/[assignmentId]` | Remove one Class/Section Teacher assignment | — | `404` if not found or wrong school |
| `POST` | `/api/schools/[id]/attendance` | Bulk-mark attendance for one date | `{academicSessionId, schoolGradeId, sectionId?, date: "YYYY-MM-DD", records: [{studentId, status, remarks?}]}` | Auth: `requireSchoolAdmin` OR `requireClassTeacher` scoped to `sectionId` (omitted = whole grade, requires a Grade Class Teacher). A student whose actual `GradeHistory` placement doesn't match the target is skipped; an already-marked student for that date is skipped, not erroneous |
| `PATCH` | `/api/schools/[id]/attendance/[attendanceId]` | Correct an already-marked day's status/remarks | `{status?, remarks?}` | Audited via `correctAttendance()` — inserts an `AttendanceAudit` row every time, capturing both fields even if only one changed. Auth scope resolved from the record itself, not client input |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/teaching-plan` | Set or update the planned-total/display-label plan for one scope | `{sectionId?, plannedTotal, unitLabel?}` | Find-or-update-else-create — never a duplicate row per `(gradeSubjectId, sectionId)` |
| `POST` | `/api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]/units` | Create one TeachingUnit (Unit/Chapter) | `{sectionId?, title}` | `order` auto-assigned (current count in scope + 1) |
| `PATCH` | `/api/schools/[id]/units/[unitId]` | Update a unit's title and/or teaching-progress status | `{title?, status?}` | Status transitions manage `startedAt`/`completedAt` automatically |
| `POST` | `/api/schools/[id]/units/[unitId]/tests` | Create a Unit/Chapter Test | `{title, testDate, maxMarks}` | `400` if the unit is still `NOT_STARTED`; pre-creates a `PENDING` `UnitTestResult` row for every enrolled student in the unit's scope |
| `PATCH` | `/api/schools/[id]/tests/[unitTestId]/results` | Bulk-record student evaluations | `{results: [{studentId, status, marksObtained?, remarks?}]}` | `status: "ABSENT"` forces `marksObtained: null`; `status: "EVALUATED"` requires `0 ≤ marksObtained ≤ maxMarks`, otherwise skipped |

## Schools — Teacher Qualitative Evaluation & Parent-Teacher Meetings (Phase 3C)

Auth: `requireSchoolAdmin(id)` OR the specific `requireClassTeacher`/`requireTeacherAssignment` scope noted per route — see [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md) for full behavioral detail; this table is structural.

| Method | Endpoint | Purpose | Important request data | Important response / errors |
|---|---|---|---|---|
| `POST` | `/api/schools/[id]/students/[studentId]/evaluations` | Create a General (`gradeSubjectId` omitted) or Subject (`gradeSubjectId` set) qualitative evaluation | `{teacherId?, gradeSubjectId?, remarks}` | Auth: `requireTeacherAssignment` (subject set) or `requireClassTeacher` (general) for the acting teacher, OR `requireSchoolAdmin` with a validated `teacherId` in the body. `409` if this teacher already has an evaluation for this student/session/scope — explicit app-level pre-check for the `gradeSubjectId: null` NULL-uniqueness gap |
| `PATCH` | `/api/schools/[id]/evaluations/[evaluationId]` | Edit `remarks` and/or share with Parent/Student | `{remarks?, share?: "PARENT" \| "STUDENT"}` | Remarks edits go through `updateEvaluationRemarks()` — silent while private, inserts a `StudentEvaluationAudit` row once shared with either audience. Sharing is one-way (no un-share) |
| `POST` | `/api/schools/[id]/meetings` | Bulk-schedule Parent-Teacher Meetings — one item for occasional, many for periodic | `{meetings: [{studentId, teacherId?, gradeSubjectId?, scheduledAt, location?, onlineUrl?}]}` | Every item resolved/validated before the transaction opens (Postgres-safe pattern, not the SQLite-only catch-mid-transaction one); ineligible items silently counted in `skipped` |
| `PATCH` | `/api/schools/[id]/meetings/[meetingId]` | Update status/outcomeNotes/linkedEvaluationId, and/or reschedule (scheduledAt/location/onlineUrl) | `{status?, outcomeNotes?, linkedEvaluationId?, scheduledAt?, location?, onlineUrl?}` | Auth by identity — `requireSchoolAdmin` OR specifically the (still-`approved`) teacher the meeting's own `teacherId` names, not re-derived scope. `linkedEvaluationId` validated to belong to the same student. Any of `scheduledAt`/`location`/`onlineUrl` present triggers reschedule handling — `400` unless the meeting is still `SCHEDULED`; not audited |

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

## Notifications

| Method | Endpoint | Purpose | Auth | Authz | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/notifications/mark-read` | Mark all of the caller's notifications read | ✅ | inline | Bulk `updateMany` |
| `GET` | `/api/notifications/unread-count` | Unread badge count | — | — | Returns `{count: 0}` for a logged-out caller rather than erroring |

## Not implemented / not applicable

No routes exist for: deleting a `User`/`School`/`Organization`/`Course`/`Section`/`Subject`/`TeachingUnit`/`UnitTest`, deactivating a school/organization (`isActive` is read but never set by any route), section-level analytics/reporting, copying a `GradeSubject` offering or `TeachingPlan`/`TeachingUnit` set forward from a prior session (each session is configured from scratch, deliberately), teaching hierarchy (primary/assistant/substitute teacher, for either `TeacherAcademicAssignment` or `ClassTeacherAssignment`), retesting a `UnitTestResult`, homework/assignments, examinations beyond Unit/Chapter Tests, report cards, analytics, payment processing, PDF certificate export, QR code generation, or grade-certificate issuance. See [KNOWN_GAPS.md](KNOWN_GAPS.md).
