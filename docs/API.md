# API Reference

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase — every route below exists in `src/app/api/**/route.ts` as documented. This is a complete inventory; nothing here is invented.

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
| `POST` | `/api/schools/[id]/teacher-assignments` | Bulk-create teacher→grade assignments for one session | `{academicSessionId, assignments: [{teacherId, schoolGradeId}]}` | One transaction; invalid/foreign ids and duplicates silently counted in `skipped`, not errored |
| `DELETE` | `/api/schools/[id]/teacher-assignments/[assignmentId]` | Remove one assignment | — | `404` if not found or wrong school |
| `POST` | `/api/schools/[id]/grade-placements` | Bulk-create first-time `GradeHistory` rows | `{academicSessionId, placements: [{studentId, schoolGradeId}]}` | Direct creation, **not** `recordGradeDecision()`; one transaction; duplicates counted in `skipped` |
| `POST` | `/api/schools/[id]/grade-decisions` | Bulk-apply a Promotion decision | `{gradeHistoryIds: string[], status: "COMPLETED, REPEATED, TRANSFERRED, or LEFT", outcomeSchoolGradeId?}` | Every row routed through `recordGradeDecision()` inside one transaction; ineligible ids (wrong school, already decided) pre-filtered and counted in `skipped`; `400` if zero ids are eligible |
| `POST` | `/api/schools/[id]/grade-rollover` | On-demand re-run of the carry-forward sweep against the current session | — | `400` if no `ACTIVE` session; idempotent — re-running with nothing new to place returns `placed: 0`, never an error |

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

No routes exist for: deleting a `User`/`School`/`Organization`/`Course`, deactivating a school/organization (`isActive` is read but never set by any route), payment processing, PDF certificate export, QR code generation, or grade-certificate issuance. See [KNOWN_GAPS.md](KNOWN_GAPS.md).
