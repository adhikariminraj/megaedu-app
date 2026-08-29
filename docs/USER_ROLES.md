# User Roles

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29 (Phase 3B, plus the Parent Academic Visibility follow-up), against the current codebase.

All seven roles below are ✅ implemented and stored identically: a `UserRole` row (`{ userId, role }`, plain string, `@@unique([userId, role])`). A single MEGA ID (`User`) can hold **multiple roles at once** — see [MEGA_ID.md](MEGA_ID.md). `dashboard/page.tsx` picks which dashboard to show using a fixed priority order (below), not a strict one-role-per-account rule.

## PLATFORM_ADMIN

Gated everywhere by `requirePlatformAdmin()` (`src/lib/authorize.ts`).

- Sees the **Platform Administration Command Center** dashboard — real counts (schools, organizations, teachers, students, courses, certificates, MEGA IDs by role), the schools/organizations verification queues inline, and a "Platform Insights" panel that explicitly lists metrics not yet available rather than showing invented numbers.
- Verifies schools and organizations (`/admin/schools`, `/admin/organizations`, `POST /api/admin/{schools,organizations}/[id]/verify`).
- Can view **any** certificate's preview page, not just their own.
- Seeded fixture: `admin@megaedu.local`.
- ⚠️ No route or UI exists to grant/revoke `PLATFORM_ADMIN` from within the app — only via `seed.ts` or direct database access.

## SCHOOL_ADMIN

- Registers a school and becomes its first `SchoolAdmin` (a school can have more than one admin).
- Full dashboard (`DashboardClient.tsx`, tabbed: Profile / Programs / News / Opportunities / Staff / Students / Finance) — edits school profile, posts programs/news/opportunities, approves pending teachers and students, manages accountants.
- **Phase 2 — Academic Sessions & Grades**, all gated the same way (resolve their own school, no explicit schoolId needed since a School Admin only ever administers their own):
  - `/dashboard/setup` — the 7-step Initial School Setup wizard (session, grades, display names, sections, teacher assignments, student placement + section assignment, review).
  - `/dashboard/grades` — the grades index, per-grade rosters, and the persistent Pending/Unresolved queue.
  - `/dashboard/sessions/new` — closing the current session and opening a new one, with a preview of exactly what will happen to every student first.
  - **Sections** — the only role that can create a section, rename one, deactivate/reactivate one, or assign a student to one. No hard-delete exists for any role. See [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md#sections-).
- **Phase 3A — Subjects & Teacher Academic Assignment**, same access pattern:
  - `/dashboard/academics` — manage the subject catalog (create/rename/deactivate), configure which subjects each grade offers for the current session, and assign/remove teacher subject-teaching assignments (grade-wide or section-specific).
  - The only role that can do any of this — no hard-delete exists for `Subject` (deactivate only); `GradeSubject`/`TeacherAcademicAssignment` do have real delete routes since they're current-state, non-historical data. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md).
- **Phase 3B — School Academic Operations**, same access pattern, plus full oversight of everything Teachers can do below:
  - Assign/remove Grade Class Teachers and Section Teachers (`/dashboard/academics`'s per-grade panel) — no overlap rule, unlike subject assignment.
  - `/dashboard/attendance` — mark or correct attendance for any grade/section/date.
  - `/dashboard/academics/[gradeSubjectId]` — set/edit Teaching Plans, create Units/Chapters and mark their progress, create Unit/Chapter Tests and evaluate every student, for any grade/section/subject at the school (not gated by having a personal `TeacherAcademicAssignment`, unlike a Teacher). See [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md).
- Gated by `requireSchoolAdmin(schoolId)` on every underlying write route.
- Also has finance access via `requireSchoolFinance` (admin **or** accountant link).

## TEACHER

- Registers with school affiliation, or generically then `/api/teacher/join-school`. Starts `approved: false`; a School Admin must approve. Re-joining a school resets approval.
- Dashboard: school status, interests, "Your Students" (Skill management, school-wide — "grade-specific scoping arrives in a later phase" 🔭, still true after Phase 2 shipped: `Skill` creation isn't scoped to a teacher's `TeacherGradeAssignment`s), enrolled courses with certificate links.
- Can enroll in and complete MEGA Academy courses.
- Can add `Skill` records to any approved student at their school.
- **Phase 2**: can be assigned to grades via `TeacherGradeAssignment` (done by a School Admin during Initial Setup), but has no dashboard view of their own assignment or their assigned students' grade rosters — that surface belongs to the School Admin today. 🔭
- **Phase 3A**: can be assigned to a specific (session, grade, section-or-whole-grade, subject) via `TeacherAcademicAssignment` (done by a School Admin on `/dashboard/academics`). Unlike `TeacherGradeAssignment` above, a Teacher **does** now see their own current assignments — a "Your Academic Assignments" section on their dashboard, scoped to the active session, each now linking into the Phase 3B units page below.
- **Phase 3B**: within each `TeacherAcademicAssignment`'s own scope (grade-wide covers every section; section-specific covers only that section — enforced server-side via `requireTeacherAssignment()`), a Teacher can set the Teaching Plan, create/manage Units or Chapters and their progress status, create Unit/Chapter Tests (once a unit is `IN_PROGRESS` or `COMPLETED`), and evaluate students on them — all at `/dashboard/academics/[gradeSubjectId]`. If also holding a `ClassTeacherAssignment` (Grade Class Teacher or Section Teacher), a Teacher sees a "Your Class & Section Teacher Responsibilities" dashboard section and can take/correct attendance at `/dashboard/attendance`, scoped to exactly the grades/sections that assignment covers (verified: a Section Teacher cannot mark another section, or the whole grade unscoped). Neither of these is gated only in the UI — every write route enforces the same scope server-side.

## STUDENT

- Registers with school affiliation, or generically + `/api/student/join-school`. Same approval gate as Teacher.
- Dashboard: school status, interests, read-only Skills list, enrolled courses with certificate links.
- Certificate recipient for course completions.
- **Phase 2**: is placed into `GradeHistory` rows by a School Admin; has no dashboard visibility into their own current grade, promotion history, or session status. 🔭
- **Phase 3B**: does now see, read-only, three new dashboard sections scoped to the active session and their own current `GradeHistory` placement: **Teaching Progress** (per subject: completed/in-progress/total units), **Test Results** (per `UnitTestResult`: marks, status, remarks), and **Recent Attendance** (last 15 days, reflecting any corrections — verified live). No write action of any kind.

## PARENT

- Registers requiring the child to already exist as a `Student` (matched by email), or generically + `/api/parent/link-child` to add more children. Can link multiple children.
- Dashboard: read-only view of each linked child's school, grade (legacy `gradeLevel` text, not the Phase 2 structured grade), and approval status; a link-another-child prompt.
- No write actions beyond linking children.
- **Phase 2**: no visibility into a linked child's `GradeHistory` at all. 🔭
- **Phase 3B (Parent Academic Visibility, added as a follow-up)**: does now see, read-only, the same three sections a Student sees about themselves — Teaching Progress, Test Results, and Recent Attendance — separately for **each** linked child, nested under that child's own card. Every `studentId` used to fetch this data is resolved server-side from the Parent's own `ParentStudent` rows (never from client input), so one parent can never see a child they aren't linked to, and one child's data never mixes into another's — verified live with two children (one real, one throwaway) showing fully distinct information side by side. Still no visibility into raw `GradeHistory` (current grade/section) — only these three derived views.

## ORGANIZATION_ADMIN

- Registers directly, or generically + `/api/organizations/create-for-admin`.
- Dashboard (`OrgDashboard.tsx`, tabbed: Courses / Opportunities / Finance): creates and manages courses, posts opportunities, manages accountants.
- Gated by `requireOrgAdmin(organizationId)`; course-content routes additionally use `requireCourseOwner(courseId)`.
- ⚠️ An unverified organization can still create, edit, and — as far as the code enforces — publish a course; nothing checks `Organization.verified` before publishing or allowing enrollment (confirmed via a fresh code search — zero matches). See [KNOWN_GAPS.md](KNOWN_GAPS.md).

## ACCOUNTANT

- **Not self-registerable.** Granted by a School Admin or Organization Admin via email (auto-adds the `ACCOUNTANT` role in a transaction).
- Dashboard: lists every school/organization the person has finance access to, states plainly that no transaction data exists yet since payments aren't built.
- Gated by `requireSchoolFinance`/`requireOrgFinance` — deliberately check **both** the Admin link and the Accountant link. An Admin retains full authority (finance included); a pure Accountant gets finance access **only**.

### School Accountant vs. Organization Accountant ✅

These are two distinct join tables and two distinct grants, not one shared "accountant" concept:

| | School Accountant | Organization Accountant |
|---|---|---|
| Model | `SchoolAccountant` (`userId`, `schoolId`) | `OrganizationAccountant` (`userId`, `organizationId`) |
| Granted by | `POST /api/schools/[id]/accountants` (School Admin) | `POST /api/organizations/[id]/accountants` (Org Admin) |
| Authorization helper | `requireSchoolFinance(schoolId)` | `requireOrgFinance(organizationId)` |
| Scope | that one school's finance surface | that one organization's finance surface |

A person can hold either, both (for different institutions), or neither — the `ACCOUNTANT` `UserRole` is the same for both, but access is always scoped per-institution via the join table, never global.

## Dashboard role-priority order ✅

`dashboard/page.tsx` checks roles in this fixed order and renders the first match: `PLATFORM_ADMIN → SCHOOL_ADMIN → TEACHER → STUDENT → PARENT → ORGANIZATION_ADMIN → ACCOUNTANT`, falling back to a generic "not linked to anything yet" message if none match. Explicitly commented in the code as "a simple MVP priority order, not a permission hierarchy" — a person with multiple roles only ever sees one dashboard per visit.

## Approval workflows summary

| Who | Approved by | Re-triggered by |
|---|---|---|
| Teacher | School Admin | Re-joining a school |
| Student | School Admin | Re-joining a school |
| School | Platform Admin (`verified` flag) | Never — no re-verification flow |
| Organization | Platform Admin (`verified` flag) | Never |
| Accountant | Granted directly, no approval queue | N/A |
