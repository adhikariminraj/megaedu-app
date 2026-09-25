# MEGA.EDU V2 — Technical Documentation

> **Audience**: the project owner, developers, maintainers, and anyone planning future MEGA.EDU development.
> **Baseline**: repository commit `120316d` (2026-09-24). Written 2026-09-25 from a read-only audit of the current code, Prisma schema (83 models), routes, and existing `/docs`.
> **Role of this document**: the principal technical reference for **MEGA.EDU V2** — the whole platform in one place, with honest status for every area. It does **not** replace the detailed subsystem documents in `/docs` (each remains the authoritative deep reference for its own area and is linked throughout), and it does not replace the historical [MEGA_EDU_Technical_Documentation.md](MEGA_EDU_Technical_Documentation.md), which is preserved as-is. Where an older document disagrees with the code, see [Appendix B](#appendix-b--documentation-reconciliation-notes).
> **Database update (2026-09-25, PostgreSQL block PG-KM1–PG-KM10)**: only the database statements below were revised, to reflect branch `pg-foundation` (local PostgreSQL in development, not yet merged into `main`, which still uses SQLite). Everything else remains at the `120316d` baseline. Details: [DEPLOYMENT.md](DEPLOYMENT.md), [KNOWN_GAPS.md](KNOWN_GAPS.md#postgresql-findings-f1f7).
> **Companion V2 documents**: [Product User Guide](MEGA_EDU_V2_Product_User_Guide.md) · [Development Status](MEGA_EDU_V2_Development_Status.md) · [Master Roadmap](MEGA_EDU_V2_Master_Roadmap.md).

### Status legend (used in all four V2 documents)

| Mark | Meaning |
|---|---|
| ✅ **Implemented** | Working functionality exists in the code today and is protected |
| 🟡 **Partially implemented** | Real, working functionality exists, but meaningful pieces are missing |
| 🟠 **Foundation / schema only** | A model or architecture exists, but little or no usable product functionality |
| 📋 **Planned** | Designed, or explicitly deferred with a recorded decision — not built |
| 🔵 **Conceptual / future vision** | Part of the MEGA.EDU vision; no design and no implementation |
| ⚠️ **Known gap** | A real, evidenced weakness or missing piece in something that otherwise exists |

**Source discipline**: nothing below describes a planned or conceptual capability as if it were built. Every "Implemented" claim was checked against code during the V2 audit or taken from a subsystem document verified current against code; claims that could not be re-verified are marked as such.

---

## Table of Contents

**Part I — Platform**
1. [Vision and platform structure](#1-vision-and-platform-structure)
2. [Core architecture](#2-core-architecture)
3. [MEGA ID / User identity](#3-mega-id--user-identity)
4. [Authentication and authorization](#4-authentication-and-authorization)
5. [Institutional context](#5-institutional-context)

**Part II — Domains**

6. [School domain](#6-school-domain)
7. [Teacher domain](#7-teacher-domain)
8. [Student domain](#8-student-domain)
9. [Parent domain](#9-parent-domain)
10. [Organization domain](#10-organization-domain)
11. [MEGA Academy](#11-mega-academy)
12. [Courses and enrollment](#12-courses-and-enrollment)
13. [Certificates](#13-certificates)

**Part III — School academic system**

14. [Academic Sessions](#14-academic-sessions)
15. [Grades, Sections and Grade History](#15-grades-sections-and-grade-history)
16. [Attendance](#16-attendance)
17. [Homework](#17-homework)
18. [Assessment and Evaluation](#18-assessment-and-evaluation)
19. [Academic Snapshot](#19-academic-snapshot)

**Part IV — Shared services**

20. [School Website / public pages](#20-school-website--public-pages)
21. [Educational Approaches](#21-educational-approaches)
22. [Resources](#22-resources)
23. [Opportunities](#23-opportunities)
24. [Events and Calendar](#24-events-and-calendar)
25. [Notifications](#25-notifications)

**Part V — Platform & business services**

26. [Platform Administration](#26-platform-administration)
27. [Payments and subscriptions](#27-payments-and-subscriptions)
28. [Marketplace](#28-marketplace)
29. [Holistic Development](#29-holistic-development)

**Part VI — Engineering reference**

30. [Database architecture](#30-database-architecture)
31. [Authorization primitives](#31-authorization-primitives)
32. [Reusable services](#32-reusable-services)
33. [Current known gaps](#33-current-known-gaps)
34. [Future architectural direction](#34-future-architectural-direction)
35. [Development history and milestones](#35-development-history-and-milestones)
36. [Protected architectural principles](#36-protected-architectural-principles)

[Appendix A — Documentation index](#appendix-a--documentation-index) · [Appendix B — Documentation reconciliation notes](#appendix-b--documentation-reconciliation-notes)

---

# Part I — Platform

## 1. Vision and platform structure

**The vision.** MEGA.EDU is intended to be a national education network and multi-sided platform — not a collection of school websites — connecting Schools, Teachers, Students, Parents and Educational Organizations through one identity (MEGA ID) and shared services (MEGA Academy, Resources, Educational Approaches, Events, Opportunities, a future Marketplace), with a long-term destination of holistic education and human development.

**The current reality.** Development has gone deepest into the School domain, deliberately: a school's daily academic work had to be real before the wider network could be. The result is a mature School foundation, a real-but-maturing Organization and MEGA Academy layer, working shared public services, and platform services that range from built (notifications, verification) to schema-only (payments) to absent (marketplace).

**The four-level map** (vision structure from the V2 Master Development Plan, with current status):

| Level | Blocks | Current status |
|---|---|---|
| **1 — Core foundation** | MEGA ID, institutional context, authorization, evidence | ✅ Implemented (School side mature; Organization side 🟡) |
| **2 — Ecosystem domains** | Schools, Teachers, Students, Parents, Organizations, MEGA Academy | Schools/Teachers/Students/Parents ✅ · Organizations 🟡 · MEGA Academy 🟡 (core loop ✅) |
| **3 — Shared services** | School Website, Resources, Approaches, Events, Opportunities, Marketplace | Approaches ✅ · Opportunities/Events/Resources/School Website 🟡 · Marketplace 🔵 |
| **4 — Platform & business services** | Payments, Notifications, Analytics, Platform Admin, Trust & Safety | Notifications ✅ (in-app) · Platform Admin 🟡 · Payments 🟠 · Analytics 🟠 · Trust & Safety ⚠️ minimal |
| **Long-term destination** | Holistic Development | 🔵 Conceptual |

The full per-area matrix is in [MEGA_EDU_V2_Development_Status.md](MEGA_EDU_V2_Development_Status.md).

**The separation that must hold**: **School ≠ Organization ≠ MEGA Academy ≠ MEGA.EDU platform.**
- **School** — an institutional education environment: students, teachers, parents, academic operations.
- **Organization** — an independent educational institution/provider with its own identity, administration, and verification.
- **MEGA Academy** — the platform environment through which organizations (approved providers) offer courses and certificates.
- **MEGA.EDU** — the platform connecting all of these and providing shared services.

A `Course` belongs to an `Organization`, never to a `School`; the two meet only at `Certificate.associatedSchoolId`, an informational link. See [§36](#36-protected-architectural-principles).

---

## 2. Core architecture

✅ **A single Next.js 14 App Router application** — pages and API routes colocated under `src/app`, one Prisma client (`src/lib/prisma.ts`), no separate backend service, no queue/worker layer.

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript | Server components by default; client components for dashboards/forms |
| Styling | Tailwind CSS | No CSS-in-JS |
| ORM / database | Prisma 5.20 · PostgreSQL in development (local PostgreSQL 18, `megaedu_dev`, branch `pg-foundation`); `main` still SQLite (`prisma/dev.db`) | Tested in development only (PG-KM1–PG-KM10); staging/production not configured — hosting decision (D3) open ⚠️ |
| Schema changes | Reviewed migrations in `prisma/migrations/` (branch `pg-foundation`) | `prisma db push` retired (D5); migrations generated/checked in GitHub Actions, applied locally with `prisma/apply-migrations.ps1` — see [DEPLOYMENT.md](DEPLOYMENT.md#schema-changes-migrations-) |
| Authentication | NextAuth 4, Credentials provider, JWT sessions | See [§4](#4-authentication-and-authorization) |
| Validation | `zod` on registration routes; hand-written checks elsewhere | |
| File uploads | Local filesystem (`public/uploads/`, `private-uploads/`) | ⚠️ needs object storage before serverless deployment |
| Tests | **None automated** ⚠️ | Verification is manual: `tsc --noEmit`, `npm run db:verify:demo`, live browser tests with throwaway fixtures |
| Deployment | **Nothing deployed** | No hosting, CI/CD, or Dockerfile exists |

**Rendering and data patterns** (consistent across the app):
- Server components query Prisma directly and pass props to client components.
- Mutations: client `fetch()` → check `res.ok` → `router.refresh()`. No client-side global state manager.
- **"One audited write path"**: anything that must be atomic with a side effect, or must never be bypassed, goes through exactly one function (e.g. `recordGradeDecision()`, `correctAttendance()`, `issueCourseCertificate()`, `recordOrCorrectCompletion()`) — see [§32](#32-reusable-services).
- Authorization is enforced **server-side on every write route**, never by hiding UI. Reads resolve the caller's scope from their own session-derived relationships, never from client-supplied ids.

Detail: [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 3. MEGA ID / User identity

✅ **`User` is the one person-level identity.** A MEGA ID is `User.id`. One person has one MEGA ID regardless of how many roles or institutions they are connected to.

- **`UserRole`** — `{userId, role}`, unique per pair; a user can hold several roles: `PLATFORM_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`, `ORGANIZATION_ADMIN`, `ACCOUNTANT`. The role flag is a **routing hint only** — every access decision checks the institution-scoped relationship row, never the flag alone.
- **Role profiles** — `Teacher`, `Student`, `Parent` are optional 1:1 profiles on a `User`. `Teacher.fullName`/`Student.fullName` are the official institutional names (independent of `User.name`). A `Teacher`/`Student` may exist **without** a `User` (e.g. an institutional record with no account) — such a person has no MEGA ID. ⚠️ ([KNOWN_GAPS.md](KNOWN_GAPS.md): a userless student with no affiliation row cannot have address/DOB/Student ID edited.)
- **Person-level attributes live on `User`** — profile photo (`avatarUrl`), Current/Permanent addresses. Family & Emergency Contacts (`FamilyContact`) are administrative records attached to a Student or Teacher and **never** grant portal access.
- **My Profile** (`/dashboard/profile`) ✅ — every user's self-service page: MEGA ID with Copy button, photo, roles, institutional relationships (every school affiliation, including ended history), password change (blocked for `@megaedu.local` demo accounts), addresses.
- **Multi-role users** ✅ — `/dashboard` renders one dashboard using a fixed order (`PLATFORM_ADMIN → SCHOOL_ADMIN → TEACHER → STUDENT → PARENT → ORGANIZATION_ADMIN → ACCOUNTANT`), explicitly *not* a permission hierarchy. Since 2026-09-22 the resolved dashboard shows a note such as "Your MEGA ID is also linked as Parent. This is your Teacher view." (`describeOtherRoles()`, `src/lib/roleContext.ts`). 📋 A real role/context switcher is not built.
- **Not built** 🔵/📋: a separate Person/Learner identity layer (considered and rejected — `User.id` already serves), professional identity portable beyond one school's affiliation record, account deactivation/deletion.

Detail: [MEGA_ID.md](MEGA_ID.md), [USER_ROLES.md](USER_ROLES.md).

---

## 4. Authentication and authorization

### Authentication ✅
`src/lib/auth.ts` — NextAuth v4, single Credentials provider (email + password, `bcrypt`), JWT session strategy; `id` and `roles` are copied into the token and session. Custom login at `/login`. Registration pages: `/register` (role-aware), plus `/register-school`, `/register-teacher`, `/register-student`, `/register-parent`, `/register-organization` (a redirect into `/register`).

⚠️ **Not built**: password reset / "forgot password", email verification, rate limiting, session revocation ("log out everywhere"), OAuth/SSO, MFA.

### Authorization ✅
Every write route calls a server-side guard; every read of another person's data resolves scope from the caller's own relationships. The guard suite and its semantics are in [§31](#31-authorization-primitives). Key rules:
- **School Admin** authority is school-wide for their own school (`requireSchoolAdmin`).
- **Teacher** authority is **assignment-scoped**: Subject Teacher actions require a matching `TeacherAcademicAssignment` (`requireTeacherAssignment`); attendance and general evaluations require a matching `ClassTeacherAssignment` (`requireClassTeacher`). Being a Class Teacher grants **no** assessment-results authority.
- **Student Profile** (staff page) uses `resolveStudentViewAccess()`: School Admin school-wide; a Teacher only for a student in a grade/section their own assignment covers.
- **Parent** access to a child exists **only** through a *confirmed* `ParentStudent` link (`confirmedAt` set).
- **Organization Admin** authority is per organization (`requireOrgAdmin`; course content via `requireCourseOwner`).
- **Academy learner** access is by `CourseEnrollment.userId` — the learner's own MEGA ID.

Detail: [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).

---

## 5. Institutional context

### School context ✅ (mature)
Three layers: **`User`** (never school-scoped) → **`Teacher`/`Student`** (a role identity, still not school-scoped) → **`TeacherSchoolAffiliation`/`StudentSchoolAffiliation`** (the real relationship: `PENDING`/`ACTIVE`/`ENDED`, start/end dates, one row per person–school pair).

- **Lifecycle** (`src/lib/affiliation.ts`): JOIN (creates `PENDING`; a School Admin's approval makes it `ACTIVE`), LEAVE (ends it), TRANSFER (ends old + creates new atomically), REJOIN. **Disassociate ≠ delete** — ended relationships stay as history.
- **Teachers may hold 2+ simultaneous ACTIVE affiliations** (designed and tested).
- **Students may hold at most one open (ACTIVE or PENDING) affiliation** — enforced since 2026-09-08 (H2, commit `c32a293`). *(Several older documents still describe this as "undecided" — see [Appendix B](#appendix-b--documentation-reconciliation-notes).)*
- **Resolution**: `getAccessibleSchools(userId)` lists ACTIVE School Admin links + ACTIVE teacher affiliations (display/routing input only); `verifySchoolAccess(userId, schoolId)` is the real, fresh, fail-closed gate.
- **Multi-school UX**: `SchoolChooser` + the `mega_school_ctx` preference cookie (never a grant — always re-validated). Three proven patterns: URL-scoped (`/dashboard/schools/[schoolId]/…`), same-URL (`/dashboard/grades`), target-derived (`/dashboard/academics/[gradeSubjectId]`).
- **Bridge fields** (`Teacher.schoolId/approved/position/subjects`, `Student.schoolId/approved`) are transitional mirrors, kept in sync only for the 0-or-1-affiliation case — never authoritative.
- ⚠️ **Migration debt**: Initial Setup, New Session, Assessment Frameworks, and Assessment Results still pick "the" school with a plain `findFirst()` — a display issue for multi-school admins, not a security hole (writes re-check ownership).

### Organization context 🟡
`OrganizationAdmin` / `OrganizationAccountant` are flat join tables (no status/history) and remain the authoritative relationships. `getAccessibleOrganizations()` and `verifyOrgAccess()` exist (`src/lib/institutionalContext.ts`); `verifyOrgAccess()` has no caller yet. A user administering 2+ organizations sees a non-interactive list.
- 📋 **C2.3** — a 2+-organization chooser — explicitly deferred pending its own approval.
- 📋 **C2.2** — history/status on Organization roles — explicitly deferred.

Detail: [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md), [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md).

---

# Part II — Domains

## 6. School domain

✅ **The deepest-built domain.**

| Capability | Status | Where |
|---|---|---|
| School registration → Platform Admin verification | ✅ | `/register-school`, `/admin/schools` |
| School profile (description, contact, location, grades offered) | ✅ | School Admin dashboard, Profile tab |
| School logo | ✅ | Profile tab (PNG/JPEG/WebP ≤ 2 MB, magic-byte validated) |
| Official School Address (Nepal Province → District → Local Level → Ward) | ✅ | Profile tab |
| Educational Approach(es) of the school | ✅ | Profile tab (chosen from the platform catalog) |
| Programs, News/Notices (create/edit/delete) | ✅ | Programs / News tabs |
| School Opportunities (create/edit/delete) | ✅ | Opportunities tab |
| Inquiries inbox (from the public contact form) | ✅ | `/dashboard/schools/[schoolId]/inquiries` |
| Staff: approve, add teacher directly, staff search, structured responsibility chips, Teacher Profile | ✅ | Staff tab, `/dashboard/teachers/[teacherId]` |
| Students: approve, add student directly (with optional placement), student search, Assign Grade & Section, Change Section | ✅ | Students tab |
| Accountants: grant / revoke | ✅ (grant) / ✅ (revoke) | Finance tab |
| Academic system (sessions, grades, sections, subjects, assignments, attendance, homework, assessment, evaluations, meetings, promotion, report cards, mark sheets, co-scholastic, calendar) | ✅ | Part III |
| Additional School Admins | ⚠️ the schema allows several per school, but the only way to become one is creating the school — no in-app route grants an additional School Admin (same gap as Organizations) | |
| School deactivation (`isActive: false`) | ⚠️ read everywhere, never written — no deactivation action exists | |

**Teacher Profile** (`/dashboard/teachers/[teacherId]`, 2026-09-22) ✅ — staff-facing; viewable by the school's School Admin or an approved fellow Teacher. Shows identity, position, approval, the viewed teacher's **Current Responsibilities** (active-session `TeacherAcademicAssignment` + `ClassTeacherAssignment`), official address (editable by Admin only), and Family & Emergency Contacts (Admin only). Admin-only action links: "Manage school's subjects & assignments", "View this teacher's meetings".

Detail: [USER_ROLES.md](USER_ROLES.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md).

---

## 7. Teacher domain

✅ A Teacher's authority comes entirely from explicit, session-scoped assignments made by a School Admin — never from being "a teacher at the school".

| Assignment model | Meaning | Authority it grants |
|---|---|---|
| `TeacherGradeAssignment` | Teacher linked to a grade for a session (Initial Setup) | Informational |
| `TeacherAcademicAssignment` | **Subject Teacher**: session → grade → optional section → subject | Teaching plans/units/unit tests, subject evaluations, assessment marks entry + publish, homework create/edit/publish, homework completion + feedback, Student Profile for covered students |
| `ClassTeacherAssignment` | **Class Teacher** (one section) or **Grade Coordinator** (whole grade, `sectionId: null`) | Attendance, general evaluations, co-scholastic entry, homework progress view, Student Profile for covered students |

- Overlap rules: a teacher may not hold both a grade-wide and a section-specific subject assignment for the same subject; different teachers may share a subject (no teaching hierarchy). Grade Coordinator and section Class Teachers may coexist. **Nothing is carried forward** to a new session.
- **Teacher dashboard** ✅: "Your Academic Assignments" (each linking to the subject page), "Your Grade Coordinator & Class Teacher Responsibilities" (Take attendance / General evaluation), today's meetings (Teacher Today), links to Meetings, Assessment Results, Homework, Calendar; School Students (Skills), Interests, own courses.
- **Skills** — a Teacher can add Skills to any approved student at their school (school-wide, not assignment-scoped — a deliberate earlier precedent).
- 📋 Not built: teaching hierarchy (primary/assistant/substitute), portable professional record beyond affiliations, Academy Instructor role (see [§11](#11-mega-academy)).

Detail: [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md).

---

## 8. Student domain

✅
- **Joining a school**: self-register + School Admin approval, or created directly by a School Admin (approved immediately; the admin relays a temporary password). At most one open school affiliation ([§5](#5-institutional-context)).
- **Identity fields**: official name (`Student.fullName`), MEGA ID (when the student has a `User`), **Date of Birth** (`Student.dateOfBirth`), **Student ID / admission number** (`StudentSchoolAffiliation.admissionNumber`, unique per school). Editable by School Admin only.
- **Placement**: `GradeHistory` per session ([§15](#15-grades-sections-and-grade-history)); legacy `Student.gradeLevel` text is kept forever as a fallback, no longer written after Initial Setup.
- **Student dashboard** ✅: school status; Parent Requests (confirm/decline); Interests (self-declared, locked to one change per academic session); Skills (read-only, teacher-attested); Today's Homework; My Homework (history, submit/resubmit); Teaching Progress; Test Results; Recent Attendance; shared Teacher Evaluations; published Assessment Results; courses and certificates; View Calendar.
- **Report Card / Mark Sheet** ✅ authorized for the student, ⚠️ **but no dashboard link exists** — the only in-app path is a "Result Day" / "Report Card Distribution" item on the student's Calendar (when the school has created one).
- **Never visible to a Student**: Parent-Teacher Meetings, unpublished results, private evaluations, the staff Student Profile page (including their own).

---

## 9. Parent domain

✅
- **Linking is a request, confirmed by the Student** (`ParentStudent.confirmedAt`). A pending request grants nothing anywhere. Either party can decline/cancel/unlink (hard delete). Enforced at every Parent read site: dashboard bundle, Homework (`resolveApplicabilityAccess`), Report Card, Mark Sheet index, Mark Sheet document, and (since 2026-09-21) the Parent Calendar.
- **Parent dashboard** ✅, per confirmed child: identity (name, school, MEGA ID when the child has an account, Student ID, Date of Birth); **Academic Snapshot**; My Children Today summary; Today's Homework; My Homework history (view-only); Assessment Results; Teaching Progress; Test Results; Recent Attendance; shared evaluations; Parent-Teacher Meetings; View Calendar (children attributed by name).
- **Parents cannot**: write anything about a child (no homework submission, no completion, no evaluation), open the staff Student Profile, request a Parent-Teacher Meeting, or see a pending/unconfirmed child.
- ⚠️ Same Report Card / Mark Sheet navigation gap as Students ([§8](#8-student-domain)).

Detail: [PARENT_STUDENT_LINKING.md](PARENT_STUDENT_LINKING.md).

---

## 10. Organization domain

🟡 **Real entity, real administration, real public presence; institutional-context maturity is the gap.**

| Capability | Status | Notes |
|---|---|---|
| `Organization` entity (name, slug, description, website, logo, `verified`, `isActive`, `academyParticipant`) | ✅ | |
| Registration | ✅ | UI path: `/register` as Organization Admin → `CreateOrgPrompt` → `create-for-admin`. ⚠️ `POST /api/auth/register-organization` also exists with no UI caller |
| Verification by Platform Admin | ✅ | `/admin/organizations` |
| Deactivation (`isActive`) | ⚠️ read everywhere, never written | |
| `OrganizationAdmin` | ✅ first admin at creation · 📋 no second-admin grant · 📋 no admin revoke | |
| `OrganizationAccountant` | 🟠 grant ✅ / revoke ✅ — but zero capability once granted (no payments) | |
| Organization Dashboard | ✅ | Logo, Academy participation toggle, Organization Profile (description/website), tabs: Courses (with enrolled/completed counts), Opportunities, Events & Resources, Finance |
| Profile self-editing | ✅ description + website · 📋 name/slug (trust question) | |
| Public directory `/organizations` | ✅ | `verified && isActive`; search `?q=` + "MEGA Academy providers only" `?academy=1`; header nav link |
| Public profile `/organizations/[slug]` | ✅ | 404 unless `verified && isActive`; badges "Verified Organization" / "MEGA Academy Provider"; courses (if participating), opportunities, events, resources |
| Opportunities / Events / Resources | ✅ | Opportunities & Resources: create/edit/delete. Events: create/edit/**deactivate** (no delete, by convention) |
| Multi-organization access | 📋 C2.3 deferred | |

**Verification enforcement** (distinct per surface):
- **MEGA Academy** ✅ — publishing requires `verified && academyParticipant`; enrollment requires `verified && academyParticipant && isActive`; visibility requires `published && verified && academyParticipant && isActive`.
- **Public content** ✅ (since 2026-09-24) — Opportunities/Resources listings require the owner to be `verified && isActive` (`eligibleContentOwnerWhere()`), never `academyParticipant`.
- **Public links** ✅ — `Organization.website` and `Opportunity.applyUrl` must be `http(s)` (write-time on Organization routes; render-time guard everywhere).

Detail: [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md).

---

## 11. MEGA Academy

🟡 **Core learning loop ✅; maturity layers (evidence-based progress, paid access, richer credentials, instructors) not yet built.**

MEGA Academy is the platform environment through which verified, participating Organizations offer courses; any MEGA ID may learn.

| Capability | Status |
|---|---|
| Course creation by Organization Admin (title, description, approach, optional plain-text instructor name) | ✅ |
| Curriculum: `CourseModule` → `Lesson` (title, content, optional `videoUrl`); rename/edit, move up/down, delete (2026-09-21, K12) | ✅ |
| Content integrity: `videoUrl` http(s)-only; course title required; publish requires ≥1 lesson; a published course can never drop to zero lessons; never auto-unpublished (K10/K12) | ✅ |
| Publishing | ✅ gated by organization `verified && academyParticipant` |
| Public discovery `/courses`, `/courses/[slug]` (course outline), homepage, `/approaches/[slug]`, provider profile | ✅ |
| Enrollment (free), learning page `/courses/[slug]/learn`, completion, certificate | ✅ |
| **My Courses** `/dashboard/my-courses` — role-agnostic list of the viewer's own enrollments | ✅ (2026-09-22) |
| Provider attention: per-course enrolled/completed counts on the Organization Dashboard | ✅ (2026-09-22) |
| Paid enrollment | ⚠️ explicitly blocked ("Paid course enrollment isn't available yet") |
| Evidence-based completion / per-lesson progress | ⚠️ completion is **self-attested** — `POST /api/enrollments/[id]/complete` requires only ownership; `progress` is effectively 0 or 100 |
| `Instructor` model | 🟠 informational only — a name (optionally linked to a MEGA ID) shown on certificates; grants **no** permissions; no instructor dashboard |
| Programs, assessments/quizzes, live/blended learning, cohorts | 🔵 not designed |

**Identity rule (protected)**: `CourseEnrollment.userId` is the authoritative learner identity (required, `@@unique([courseId, userId])`). `teacherId`/`studentId` are nullable contextual enrichment only. Parents, School Admins, Accountants, Organization Admins, and unaffiliated users enroll exactly like anyone else. The "hard coupling to Teacher/Student" described in older planning material **no longer exists**.

Detail: [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md), [KNOWN_GAPS.md](KNOWN_GAPS.md) (MEGA Academy Development Track).

---

## 12. Courses and enrollment

✅ `POST /api/courses/[courseId]/enroll`:
1. Requires login (401).
2. Course must be `published` and its organization `verified`, `academyParticipant`, and `isActive` (else 404 "Course not available").
3. `priceCents > 0` → 400 (paid enrollment not built).
4. Idempotent on `(courseId, userId)` (`alreadyEnrolled: true`).
5. `teacherId`/`studentId` populated only if the enrolling user happens to hold that profile.

**Learning** (`/courses/[slug]/learn`): requires an enrollment for the viewer's own `userId`; shows every module/lesson in order and a completion button. Already-enrolled learners keep access even if the organization later becomes ineligible (historical access preserved).

**Completion** (`POST /api/enrollments/[enrollmentId]/complete`): owner-only; sets `progress: 100`, `completedAt`, and issues the certificate atomically via `issueCourseCertificate()`; notifies the learner.

**Visibility condition** (identical everywhere): `published && organization.verified && organization.academyParticipant && organization.isActive`.

---

## 13. Certificates

✅ **Course completion certificates.**
- **Model** — `Certificate` keeps **recipient** (`recipientUserId` — a MEGA ID), **instructor** (optional), and **issuer** (`issuerType`: `MEGA_EDU | ORGANIZATION | SCHOOL | JOINT`, plus issuer organization/school) as separate concepts; `associatedSchoolId` is informational context only. Display values are **frozen snapshots** (`recipientNameSnapshot`, `recipientMegaIdSnapshot`, `issuerNameSnapshot`, …).
- **Issuance** — `issueCourseCertificate()` is the only creator; **only `ORGANIZATION` issuer type is ever produced today**. `SCHOOL`/`JOINT`/`MEGA_EDU` exist in the model and renderer but no write path creates them. 📋
- **Viewing** — `/dashboard/certificates/[id]/preview` (recipient or Platform Admin), A4 landscape design; public verification `/verify/[code]` (no login).
- ⚠️ The public verification page displays the recipient's **MEGA ID** — an open privacy decision.
- 📋 Not built: PDF download, QR code (space reserved), grade-completion certificates (`Certificate.gradeHistoryId` reserved, `issueGradeCertificate()` does not exist), revocation.

**Mark Sheet is a separate, unmerged document** — see [§18](#18-assessment-and-evaluation). Detail: [CERTIFICATES.md](CERTIFICATES.md).

---

# Part III — School academic system

## 14. Academic Sessions

✅ One `AcademicSession` = one school year for one school; **at most one `ACTIVE` per school** (application-enforced, concurrency-safe since 2026-09-08). **Rollover** (`/dashboard/sessions/new`) closes the current session and opens the next in one transaction: students with a recorded Promote/Repeat decision are carried forward; undecided students are never guessed — they appear in a persistent Pending/Unresolved queue. Sections, subject offerings, and teacher assignments are never carried forward. Initial school setup: 7-step wizard at `/dashboard/setup`.

Detail: [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md).

## 15. Grades, Sections and Grade History

✅
- **`GradeReference`** — fixed platform ladder (PP1–PP3, Y1–Y10). **`SchoolGrade`** — a school's opt-in with its own display name. **`Section`** — optional, belongs to the grade (not the session), deactivate-only.
- **`GradeHistory`** — a student's placement for one session (`@@unique([studentId, academicSessionId])`), never deleted. Status `ENROLLED → COMPLETED | REPEATED | TRANSFERRED | LEFT`, written **only** via `recordGradeDecision()` (audited in `GradeHistoryAudit`); section changes only via `reassignSection()` (audited).
- **`resolveCurrentPlacement(studentId, schoolId)`** — the shared, school-scoped "where is this student now" resolver used by Academic Snapshot, Report Card, Student Profile authorization, and more.
- **Class Overview** (`/dashboard/grades/[schoolGradeId]`): roster by section (display-only Roll No.), teachers & subjects, "Repeated" badge, grade-wide Top 5 from published results; batch Promotion decisions.

Detail: [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md).

## 16. Attendance

✅ One row per student per calendar day (not per subject). Marked by a School Admin or the relevant Class Teacher/Grade Coordinator (`/dashboard/attendance`, and URL-scoped `/dashboard/schools/[schoolId]/attendance`). Corrections only via `correctAttendance()`, always audited (`AttendanceAudit`). "Today" is resolved in Asia/Kathmandu. Students/Parents see recent attendance (read-only); Attendance % feeds the Academic Snapshot.

Detail: [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md).

## 17. Homework

✅ **Homework v1 (K1–K6) — Assign → Complete → Teacher Review → Feedback.** *(The older Technical Documentation still describes the earlier "Phase 1" scope — see [Appendix B](#appendix-b--documentation-reconciliation-notes).)*

| Piece | What it is |
|---|---|
| `Homework` | Teacher-authored item for a grade (or one section) + subject + session; **Regular** or **Individual** (one target student); `DRAFT → PUBLISHED`; content frozen once published |
| `HomeworkApplicability` (K1) | The **only** Student ↔ Homework link, created once at publish, never recalculated (late joiners never added; transfers never erase history) |
| `HomeworkCompletion` (K2) | Subject Teacher's decision per applicable student: `COMPLETED / PARTIAL / NOT_COMPLETED / EXCUSED`; absence = "not yet recorded"; audited corrections; optimistic locking for co-teacher races |
| `HomeworkSubmissionAttempt` (K3) | Optional student evidence (text and/or one photo), append-only, late derived at submission; files stored privately and served only through an authenticated route |
| `HomeworkReview` (K4) | Subject Teacher feedback, append-only, immediately visible to the student/parent |
| Rollups (K5) | Per-homework completion summary for the Subject Teacher; read-only Homework Progress page for Class Teacher/Grade Coordinator; per-student Homework Completion % (Academic Snapshot). 📋 No School Admin school-wide rollup |
| History (K6) | "My Homework" panel — Student (can submit) and Parent (view-only) |

**Authority**: create/publish — Subject Teacher (School Admin may edit/publish but never create); completion and feedback — **Subject Teacher only** (no Admin/Class Teacher bypass); submission — the Student only. 📋 Not built: marks/grading, multi-file attachments, notifications, parent submit-on-behalf.

Detail: [HOMEWORK.md](HOMEWORK.md).

## 18. Assessment and Evaluation

✅ Two deliberately separate systems plus qualitative tools:

- **Formal assessment** — school-configurable `AssessmentFramework` (optional periods/terms, components with `MARKS | GRADE | DESCRIPTIVE` entry), `GradingScale`/bands, assignment per grade with optional subject override. Primary setup: the 6-step guided wizard (`/dashboard/assessment-frameworks/new`). Marks entry and **subject-level publishing** at `/dashboard/assessment-results` — School Admin or the Subject Teacher only. Corrections after publishing stay published and are audited. Live calculation (nothing cached): percentages, grade lookup, **unweighted** GPA with average-percentage fallback. Detail: [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md), [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md).
- **Report Card** (`/dashboard/report-card/[studentId]`) — a *live* view of published results, attendance, shared evaluations, and co-scholastic grades; no stored copy, no PDF. Access: the student, a confirmed parent, or staff at the school.
- **Mark Sheet** — the formal, **immutable, issued annual result** (`MarkSheet` + frozen subject/grading-band/co-scholastic snapshots), issued per student by a School Admin once results are published and a promotion decision exists; corrections create a new version and supersede the old one. Views: `/dashboard/students/[studentId]/mark-sheet` (Admin issue/correct), `/dashboard/mark-sheet/[studentId]` and `…/[markSheetId]` (owner/parent/staff). 📋 No PDF, no public verification, no rank/division. Detail: [MARK_SHEET.md](MARK_SHEET.md).
- **Co-Scholastic** — a separate non-numeric axis (Work Education, Art, Health & PE, Discipline…), entered by School Admin or a Class Teacher; config at `/dashboard/co-scholastic-config`, entry at `/dashboard/co-scholastic`. Detail: [CO_SCHOLASTIC.md](CO_SCHOLASTIC.md).
- **Teaching Plans, Units/Chapters, Unit Tests** — per subject at `/dashboard/academics/[gradeSubjectId]`; unit tests are informal and never merged into formal results.
- **Evaluations** — written remarks; General (Class Teacher/Grade Coordinator) vs Subject (Subject Teacher); sharing with Parent and with Student are independent, one-way; once shared, edits are audited.
- **Parent-Teacher Meetings** — scheduled by School Admin or an authorized teacher; visible to parents and staff, **never** to students. 📋 No parent-initiated requests.

Detail: [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md).

## 19. Academic Snapshot

✅ Three current-session summary figures, computed live by shared functions (never duplicated per surface), shown as **N/A (never a fake 0%)** when there is no data:

| Figure | Formula |
|---|---|
| **Attendance %** | (PRESENT + LATE) ÷ (PRESENT + LATE + ABSENT) × 100 — EXCUSED excluded |
| **Homework Completion %** | COMPLETED ÷ (Applicable − EXCUSED) × 100 — Regular homework only |
| **Overall Performance** | Unweighted GPA if any subject resolves a grade point, else unweighted average percentage |

**Visible to**: School Admin (school-wide) and assignment-covered Teachers on the staff Student Profile (`/dashboard/students/[studentId]`); confirmed Parents on their dashboard, per child. Not shown on the Student's own dashboard.

---

# Part IV — Shared services

## 20. School Website / public pages

🟡 **Real public school presence; not a website platform.**
- `/schools` ✅ — directory of `verified && isActive` schools with search, district, and approach filters.
- `/schools/[slug]` ✅ — logo, about, programs, public notices (latest 5), contact block, upcoming events.
- `/schools/[slug]/notices`, `/schools/[slug]/notices/[noticeId]` ✅ — news/notice list and detail.
- `/schools/[slug]/contact` ✅ — anonymous inquiry form → the school's Inquiries inbox.
- `/calendar` ✅ — public General Calendar + a searched school's public events.
- 🔵 Not built: templates, per-school branding/themes, custom domains, media galleries, SEO tooling — every school uses the same fixed layout.

## 21. Educational Approaches

✅ `EducationalApproach` platform catalog (seeded: Consciousness-Based Education, STEM, Montessori, Project-Based Learning, Values Education); schools choose theirs (many-to-many); courses and resources may be tagged. Public `/approaches` (cards with counts) and `/approaches/[slug]` (schools, courses, resources) — since 2026-09-24 filtered by the same public rules as their own directories (unpublished courses and unverified schools no longer listed). 📋 Schools cannot create new approaches (catalog is platform-managed via seed).

## 22. Resources

🟡 `Resource` (title, description, `fileUrl`, subject, grade level, approach; owned by a School **or** an Organization).
- ✅ Organization-side create/edit/delete (Events & Resources tab); public `/resources` and organization profile (owner must be `verified && isActive`).
- ⚠️ No search/filter on `/resources`; no file upload (`fileUrl` is a typed string and is not rendered as a public link); **no School-side posting** (who at a school may publish is undecided).

## 23. Opportunities

🟡 Scholarships, competitions, events, jobs (`Opportunity`, owned by a School or an Organization).
- ✅ Create/edit/delete from both School and Organization dashboards; public `/opportunities` with type filter, homepage feed, organization profile — owner must be `verified && isActive`.
- ✅ `applyUrl` rendered as a link only if `http(s)`; validated on Organization write paths.
- ⚠️ School opportunity routes do not validate `applyUrl` at write time (render guard covers public safety). 🔵 No application tracking, registration, or participation records.

## 24. Events and Calendar

✅ **Calendar is a projection layer**, not a second source of truth (no `CalendarEvent` model). Sources: `GeneralCalendarEntry` (Nepal national holidays/observances, network-wide), `Event` (school or organization), `SchoolCalendarEntry` (vacation, examination, special closure, PTM day, result day, report-card distribution), Parent-Teacher Meetings, Homework due dates, academic session boundaries.
- **Day Status** (one dominant colour per date: special closure > examination > vacation > public holiday > Saturday).
- **Views**: Annual (12 months) and Agenda (~30 days).
- **Who sees what**: School Admin/Teacher — `/dashboard/schools/[schoolId]/calendar` (Teacher sees own meetings/homework only); Student/Parent — `/dashboard/calendar` (parents see each child's items labelled; meetings never shown to students); public — `/calendar`.
- **Events**: create/edit/deactivate (no delete) for School Admins and Organization Admins. Organization events appear on the organization profile only.
- 📋 Not built: BS (Bikram Sambat) dates, recurring events, reminders, calendar sync/export, grade/section filters, an Organization calendar page. General Calendar data covers Sep–Dec 2026 from a secondary source.

Detail: [CALENDAR.md](CALENDAR.md).

## 25. Notifications

✅ **In-app only.** `Notification` rows are written only through `notify()` / `notifySchoolCommunity()` (`src/lib/notify.ts`, best-effort — never fails the calling action). Triggers include certificate issuance, parent link requests, parent registration, student/teacher approval, school/organization verification, and school news. Bell with unread count in the header; `/notifications` list (marks read on view).
🔵 Not built: email, SMS, push, per-user notification preferences, structured notification payloads.

---

# Part V — Platform & business services

## 26. Platform Administration

🟡
- ✅ Command Center dashboard — real counts (schools, organizations, teachers, students, courses, certificates, MEGA IDs by role) and verification queues; verify schools (`/admin/schools`) and organizations (`/admin/organizations`); view any certificate.
- ⚠️ `PLATFORM_ADMIN` can only be granted by seed script or direct database access.
- ⚠️ **Trust & Safety is minimal**: no user management, suspension, moderation, content flagging, or audit log of admin/authorization decisions. The dashboard itself notes "no admin API yet" for user management. `verified`/`isActive` flags are the only trust controls (and `isActive` is never written).
- 🟠 **Analytics**: the admin counts are the only analytics surface; nothing per-school, per-organization, or cross-domain.

## 27. Payments and subscriptions

🟠 **Foundation / schema only.**
- `Subscription` (user or school, plan, status) and `Payment` (amount, currency NPR, status, provider, providerRef) exist in the schema — **no code anywhere reads or writes either**. Their shape is School-subscription-oriented, not Course-purchase-oriented.
- `Course.priceCents` exists; any priced course is **blocked** from enrollment. No payment provider (eSewa/Khalti or other) is integrated.
- `requireOrgFinance()` / `requireSchoolFinance()` exist; Accountant dashboards show "no transaction data" by design.
- 🔵 Entitlements, revenue sharing, invoicing, refunds, bundles/premium: not designed.

## 28. Marketplace

🔵 **Not implemented.** No model, route, page, or component references a marketplace. The Organization entity and `Course.priceCents` are *possible* foundations, nothing more. Marketplace depends on Payments, which does not exist yet.

## 29. Holistic Development

🔵 **Strategic direction only.** No schema, route, or UI represents holistic/whole-person development today. The closest existing building blocks are the qualitative ones (evaluations, co-scholastic areas, interests, skills) — none were built as a holistic-development system and none should be described as one.

---

# Part VI — Engineering reference

## 30. Database architecture

✅ 83 Prisma models (PostgreSQL with reviewed migrations on `pg-foundation`; SQLite with `db push` at the `120316d` baseline). Grouped:

| Group | Models |
|---|---|
| Identity | `User`, `UserRole`, `Interest`, `Skill`, `Address` (+ `Province`, `District`, `LocalLevel`), `FamilyContact`, `Notification` |
| Schools | `School`, `SchoolAdmin`, `SchoolAccountant`, `Program`, `NewsPost`, `Inquiry`, `SchoolApproach` |
| People & context | `Teacher`, `Student`, `Parent`, `ParentStudent`, `TeacherSchoolAffiliation`, `StudentSchoolAffiliation` |
| Academic structure | `AcademicSession`, `GradeReference`, `SchoolGrade`, `Section`, `TeacherGradeAssignment`, `GradeHistory`, `GradeHistoryAudit`, `Subject`, `GradeSubject`, `TeacherAcademicAssignment`, `ClassTeacherAssignment` |
| Operations | `Attendance`, `AttendanceAudit`, `TeachingPlan`, `TeachingUnit`, `UnitTest`, `UnitTestResult`, `StudentEvaluation`, `StudentEvaluationAudit`, `ParentTeacherMeeting` |
| Homework | `Homework`, `HomeworkApplicability`, `HomeworkCompletion`, `HomeworkCompletionAudit`, `HomeworkSubmissionAttempt`, `HomeworkReview` |
| Assessment | `AssessmentFramework`, `AssessmentPeriod`, `AssessmentComponent`, `GradingScale`, `GradingScaleBand`, `AssessmentFrameworkAssignment`, `AssessmentComponentResult`, `AssessmentComponentResultAudit`, `AssessmentResultPublication` |
| Formal results | `MarkSheet`, `MarkSheetSubject`, `MarkSheetGradingBandSnapshot`, `MarkSheetCoScholasticResult`, `CoScholasticArea`, `CoScholasticPeriod`, `CoScholasticGradeSetting`, `CoScholasticResult` |
| Organizations & Academy | `Organization`, `OrganizationAdmin`, `OrganizationAccountant`, `EducationalApproach`, `Course`, `CourseModule`, `Lesson`, `CourseEnrollment`, `Certificate`, `Instructor` |
| Shared content | `Resource`, `Event`, `Opportunity`, `GeneralCalendarEntry`, `SchoolCalendarEntry` |
| Commerce (unused) | `Subscription`, `Payment` |

**Conventions**: no Prisma enums (plain strings with documented values); frozen `*Snapshot` fields on permanent documents (certificates, mark sheets, grade-history audit); append-only audit tables; soft-deactivate (`isActive`) instead of delete for structural/historical records; the nullable scope-discriminator idiom (`sectionId`/`gradeSubjectId`/`periodId` null = general); explicit application pre-checks for the `NULL ≠ NULL` unique-index gap (same on SQLite and PostgreSQL — NULL-distinct kept by decision D7; these pre-checks are not concurrency-safe on their own — finding F2; for `ClassTeacherAssignment`'s grade-wide slot, finding F1, a partial unique index now enforces the rule on `pg-foundation`, PG-F1); additive-first schema changes. The two bulk-write routes that relied on SQLite transaction behaviour were fixed in PG-KM2 (`60b23b5`).

Detail: [DATABASE.md](DATABASE.md), [PRODUCT_RULES.md](PRODUCT_RULES.md).

## 31. Authorization primitives

✅ All return the authorized `userId` (or a role object) or `null` — they never throw.

| Primitive | File | Grants |
|---|---|---|
| `requireSchoolAdmin(schoolId)` | `authorize.ts` | School Admin of that school |
| `requireTeacherAssignment(schoolId, scope)` | `authorize.ts` | Teacher with ACTIVE affiliation + matching `TeacherAcademicAssignment` (three-way `sectionId` semantics) |
| `requireClassTeacher(schoolId, scope)` | `authorize.ts` | Teacher with ACTIVE affiliation + matching `ClassTeacherAssignment` |
| `requireOrgAdmin(organizationId)` | `authorize.ts` | Organization Admin of that organization |
| `requireCourseOwner(courseId)` | `authorize.ts` | Organization Admin of the course's organization |
| `requirePlatformAdmin()` | `authorize.ts` | Platform Admin |
| `requireSchoolFinance` / `requireOrgFinance` | `authorize.ts` | Admin **or** Accountant (org variant unwired) |
| `verifySchoolAccess(userId, schoolId)` | `institutionalContext.ts` | School Admin or ACTIVE-affiliated Teacher (school-wide) |
| `resolveStudentViewAccess(userId, studentId)` | `institutionalContext.ts` | Student Profile: Admin school-wide; Teacher only if assignment covers the student's current placement |
| `verifyOrgAccess(userId, organizationId)` | `institutionalContext.ts` | Organization Admin/Accountant (no caller yet) |
| `resolveApplicabilityAccess(...)` | `homeworkAuthorization.ts` | Homework: STUDENT (owner) / PARENT (confirmed) / TEACHER (subject scope) |

Inline checks (deliberately simple): certificate preview (recipient or Platform Admin), enrollment/completion ownership (`userId`), Parent–Student confirm/unlink (the two parties only).

## 32. Reusable services

| Module (`src/lib/`) | Key functions |
|---|---|
| `auth.ts`, `prisma.ts` | NextAuth config; Prisma singleton |
| `affiliation.ts` | JOIN/LEAVE/TRANSFER primitives, bridge-field sync |
| `institutionalContext.ts` | `getAccessibleSchools`, `verifySchoolAccess`, `getAccessibleOrganizations`, `verifyOrgAccess`, `resolveStudentViewAccess` |
| `gradeHistory.ts`, `gradeRollover.ts`, `gradeMatching.ts` | `recordGradeDecision`, `reassignSection`, `resolveCurrentPlacement`, `CURRENT_ROSTER_STATUSES`; rollover; legacy grade matching (never guesses) |
| `attendance.ts`, `evaluation.ts` | `correctAttendance`, `computeAttendanceSummary`; `updateEvaluationRemarks`, `shareEvaluation` |
| `homework*.ts` | `publishHomework`, `fetchTodaysHomework`, `fetchStudentHomeworkHistory`, `recordOrCorrectCompletion`, `createSubmissionAttempt`, `createReview`, rollups |
| `assessmentFramework.ts`, `assessmentResults.ts` | framework resolution; live calculation engine; `fetchAssessmentResults`, `buildReportCard`, `correctComponentResult` |
| `markSheet.ts`, `coScholastic.ts` | issue/correct Mark Sheet; co-scholastic fetch/entry |
| `academicProgress.ts` | `fetchAcademicProgress`, `fetchMeetingsForStudent`, `fetchMeetingsForTeacher` |
| `calendar.ts`, `schoolCalendar.ts`, `events.ts`, `monthGrid.ts` | calendar projection, Day Status, grid math |
| `certificates.ts`, `certificateView.ts` | `issueCourseCertificate`, `buildCertificateViewModel` |
| `academyContent.ts` | `parseVideoUrl` (lesson video links) |
| `safeUrl.ts`, `publicVisibility.ts` | `parseOptionalHttpUrl`, `safeHttpHref`; `eligibleContentOwnerWhere` |
| `roleContext.ts` | `describeOtherRoles` (multi-role note) |
| `notify.ts`, `uploads.ts`, `profile.ts` | notifications; validated image/file storage; My Profile relationships |

## 33. Current known gaps

The individually re-verified list is [KNOWN_GAPS.md](KNOWN_GAPS.md); the at-a-glance matrix is [MEGA_EDU_V2_Development_Status.md](MEGA_EDU_V2_Development_Status.md). The most important:

- **Security/account**: no password reset, email verification, rate limiting, or session revocation.
- **Trust & Safety**: no moderation/suspension; `isActive` never written anywhere.
- **Academy**: completion self-attested; paid enrollment blocked; certificate verify page shows MEGA ID; no PDF/QR.
- **Organizations**: C2.3 multi-org chooser and C2.2 history deferred; no second-admin grant; name/slug editing undecided; `register-organization` endpoint has no UI caller.
- **Schools**: no in-app way to add a second School Admin; four areas still on legacy single-school resolution.
- **Navigation**: Students and Parents have no dashboard link to Report Card / Mark Sheet.
- **Shared services**: no Resources search or school-side posting; school `applyUrl` write validation; no website templating.
- **Engineering**: no automated tests; nothing deployed; PostgreSQL tested in development only, F1 fixed on `pg-foundation` (PG-F1), F2–F7 open; local-filesystem uploads.
- **Commerce**: payments/marketplace absent.

## 34. Future architectural direction

*Direction only — not commitments, not approved work. The block-by-block plan is [MEGA_EDU_V2_Master_Roadmap.md](MEGA_EDU_V2_Master_Roadmap.md).* Every direction below is **additive** to protected architecture:

- **Organization maturity** — build C2.3 on the existing `getAccessibleOrganizations()`/`verifyOrgAccess()` seam (mirroring `SchoolChooser`), not a new membership model.
- **Academy maturity** — evidence-based progress (lesson completion keyed to `CourseEnrollment`), certificate issuer expansion using the existing `issuerType` field, a real Instructor capability only after an explicit design.
- **Payments** — entitlements keyed to `CourseEnrollment`/`User.id` and to `Organization`; the existing `Subscription`/`Payment` models to be reviewed, not assumed fit.
- **Trust & Safety** — use `isActive` (already read everywhere) with a real, audited deactivation action.
- **Engineering** — object storage adapter in `uploads.ts`; PostgreSQL: bulk routes fixed (PG-KM2) and development database moved (PG-KM3–PG-KM10, branch `pg-foundation`); next — F2–F7 decisions (F1 fixed, PG-F1), merge, hosting (D3); an automated test harness.

## 35. Development history and milestones

(From git history — `git log`. Dates are commit dates.)

| Period | Milestone |
|---|---|
| 2026-08-27–28 | Initial commit; Phase 1 identity + Phase 2 Academic Sessions & Grades |
| 2026-08-29 | Sections; Phase 3A Subjects & Teacher Assignment; Phase 3B Academic Operations (attendance, units, tests); Parent academic visibility; School Admin direct student/teacher creation |
| 2026-08-30–31 | Phase 3C Evaluations & Parent-Teacher Meetings; Phase 3D Assessment Framework, Results, Report Cards; guided assessment wizard; Class Overview ranking; first documentation set and dated PDFs |
| 2026-09-01–02 | Demo data system; homepage redesign; logos & profile photos; Nepal geography & addresses; Family & Emergency Contacts; institutional names |
| 2026-09-05 | Affiliation lifecycle (JOIN/LEAVE/TRANSFER); Phase 4A–4D institutional context; Public School Gateway (find, notices, inquiries); Homework Phase 1 |
| 2026-09-06–07 | Parent "My Children Today"; Teacher Today; student/staff search; password change; Calendar K1–K1.2; My Profile K1; Mark Sheet K1; Co-Scholastic |
| 2026-09-08–09 | Data-safety hardening (institutional context, session transitions, audited results, Student single-school exclusivity H2); Homework v1 K1–K6; DOB & admission number; Academic Snapshot + assignment-scoped Student Profile |
| 2026-09-10 | Organization verification enforcement; user-centric Academy enrollment; organization access context; Parent–Student link confirmation; Academy participation; provider profiles; read-time visibility; opportunity edit/delete; org logo, events & resources (K1–K8); documentation reconciliation |
| 2026-09-21 | Parent calendar confirmed-link fix; Academy content integrity (K10); curriculum authoring (K12) |
| 2026-09-22 | Whole-ecosystem user context: Teacher Profile responsibilities, staff chips, My Courses, org course counts, multi-role note |
| 2026-09-24 | First 10-km block — Organization domain strengthening (public visibility, link safety, directory search, profile editing) — `120316d` |

Detail: [CHANGELOG.md](CHANGELOG.md) *(note: see Appendix B — it lacks entries for four September commits).*

## 36. Protected architectural principles

These are the V2 baseline. Future work must **extend** them, never replace them, without explicit architectural approval:

1. **MEGA ID / `User`** is the single person identity; roles and institutions are relationships to it. No second identity system.
2. **Existing authorization primitives** ([§31](#31-authorization-primitives)) are composed, never bypassed or duplicated; authorization is always server-side and contextual.
3. **School institutional context** — affiliation rows are authoritative; ACTIVE-only resolution; disassociate ≠ delete; Student single-school exclusivity; Teacher multi-school.
4. **Organization institutional context** — `OrganizationAdmin`/`OrganizationAccountant` stay authoritative; extend via the existing resolver seam.
5. **School ≠ Organization ≠ MEGA Academy ≠ MEGA.EDU platform** — no collapsing into one generic institution model.
6. **`Course.organizationId`** — courses belong to organizations, never schools.
7. **User-centric Academy enrollment** — `CourseEnrollment.userId` is the learner identity; `teacherId`/`studentId` stay optional enrichment.
8. **Certificate issuer separation** — recipient, instructor, and issuer remain separate; snapshots are frozen; Mark Sheet stays a separate document.
9. **Assignment-scoped teacher authority** — Subject Teacher vs Class Teacher/Grade Coordinator authority stays distinct; no school-wide shortcuts on scoped surfaces.
10. **Parent access only through a confirmed, student-approved link.**
11. **One audited write path** per protected concern; audit tables append-only; published/issued things are corrected with an audit trail, never silently changed.
12. **Existing production workflows and permission boundaries** — any change must be identified, justified, and approved.

---

## Appendix A — Documentation index

| Document | Role |
|---|---|
| **V2 set** — this document, [Product User Guide](MEGA_EDU_V2_Product_User_Guide.md), [Development Status](MEGA_EDU_V2_Development_Status.md), [Master Roadmap](MEGA_EDU_V2_Master_Roadmap.md) | V2 baseline and planning reference |
| [ARCHITECTURE.md](ARCHITECTURE.md), [KNOWN_GAPS.md](KNOWN_GAPS.md) | Living architecture and gap references |
| [DATABASE.md](DATABASE.md), [API.md](API.md), [PRODUCT_RULES.md](PRODUCT_RULES.md) | Schema, route, and business-rule references |
| [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md), [USER_ROLES.md](USER_ROLES.md), [MEGA_ID.md](MEGA_ID.md), [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md), [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md), [PARENT_STUDENT_LINKING.md](PARENT_STUDENT_LINKING.md) | Identity, access, context |
| [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md), [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md), [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md), [HOMEWORK.md](HOMEWORK.md), [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md), [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md), [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md), [MARK_SHEET.md](MARK_SHEET.md), [CO_SCHOLASTIC.md](CO_SCHOLASTIC.md), [CALENDAR.md](CALENDAR.md) | School academic system |
| [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md), [CERTIFICATES.md](CERTIFICATES.md) | MEGA Academy |
| [DEPLOYMENT.md](DEPLOYMENT.md), [DEVELOPMENT_GUIDELINES.md](DEVELOPMENT_GUIDELINES.md), [TESTING.md](TESTING.md), [DEMO_DATA.md](DEMO_DATA.md), [CHANGELOG.md](CHANGELOG.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Operations and history |
| [MEGA_EDU_Technical_Documentation.md](MEGA_EDU_Technical_Documentation.md), [MEGA_EDU_Product_User_Guide.md](MEGA_EDU_Product_User_Guide.md) | Pre-V2 consolidated documents — preserved unchanged |
| `MEGA_EDU_*_2026-08-31.pdf` (and other dated PDFs) | Protected historical snapshots — never regenerated or edited |

## Appendix B — Documentation reconciliation notes

The V2 audit found older documents that no longer match the code. **They were intentionally not edited** during this documentation kilometer; where they conflict, the code — and this V2 document — reflect current behaviour. Each is a candidate for a future documentation-alignment kilometer.

| # | Document | Stale statement | Current behaviour (verified) |
|---|---|---|---|
| 1 | `MEGA_EDU_Technical_Documentation.md` §9, `USER_ROLES.md` (Organization Admin) | "`Organization.verified` is never checked before publishing or enrollment" | Enforced since 2026-09-10 (publish, enroll, visibility) |
| 2 | `MEGA_EDU_Technical_Documentation.md` §17a/§37, `MEGA_EDU_Product_User_Guide.md` §5/FAQ | Homework is "Phase 1"; submissions, feedback, history "not built"; only today's homework visible | Homework v1 K1–K6 built (completion, submissions, reviews, rollups, history); due dates also appear on Calendar |
| 3 | `MEGA_EDU_Technical_Documentation.md` §10/§10a/§37, `KNOWN_GAPS.md`, `INSTITUTIONAL_CONTEXT.md`, `MEGA_ID.md`, a code comment in `src/lib/institutionalContext.ts` | Student simultaneous multi-school affiliation is "undecided / nothing blocks it" | Enforced single open affiliation per Student since 2026-09-08 (H2, `c32a293`) |
| 4 | `MEGA_EDU_Product_User_Guide.md` §7 | "Open the Report Card from the student's dashboard" | No dashboard link exists for Students/Parents; reachable via Calendar Result Day items or direct URL |
| 5 | `USER_ROLES.md` (last verified 2026-08-29) | Student/Parent/Org Admin capability lists | Understate current capabilities (assessment results, homework, Academic Snapshot, calendar; org Events & Resources, profile editing) |
| 6 | `PARENT_STUDENT_LINKING.md` | Lists five `confirmedAt` enforcement sites | Six — the Parent Calendar was added 2026-09-21 |
| 7 | `MARK_SHEET.md` | "Roll/symbol/admission number — no such field exists anywhere in the schema" | `StudentSchoolAffiliation.admissionNumber` added 2026-09-09 (not shown on Mark Sheet) |
| 8 | `MEGA_EDU_Technical_Documentation.md` §7/§37 | `isActive` "read in two places" | Read across all public directories/listings and enrollment (never written) |
| 9 | `CERTIFICATES.md` | Organization has no `logoUrl` | `Organization.logoUrl` exists (not used on certificates) |
| 10 | `CHANGELOG.md` | — | Missing entries for `215dc9f`, `a9c9624` (K10), `57f6576` (K12), `b856301` |
| 11 | `ASSESSMENT_RESULTS.md` (2026-08-31), `PRODUCT_RULES.md` (2026-08-30) | Oldest "last verified" dates | Not re-verified against later Mark Sheet/Co-Scholastic/hardening work |
| 12 | `MEGA_EDU_Technical_Documentation.md` §25 | Dashboard list | Omits `AccountantDashboard` and `/dashboard/my-courses` |
