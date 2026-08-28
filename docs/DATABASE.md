# Database

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against `prisma/schema.prisma` directly.

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

All six models below are pushed to the database **and** actively read/written by real routes — this is no longer schema-only. See [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) and [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) for the full behavioral write-up; this section covers structure only.

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
**Delete behavior**: cascades from `School`; the creation route (`POST /api/schools/[id]/grades`) is additive-only — it never deletes a `SchoolGrade` a school previously opted into.

### `TeacherGradeAssignment`
**Purpose**: per-session teacher-to-grade link. **Currently used**: yes.
**Key fields**: `id, teacherId (FK), schoolGradeId (FK), academicSessionId (FK)`.
**Constraints**: `@@unique([teacherId, schoolGradeId, academicSessionId])`.
**Delete behavior**: cascades from `Teacher`; a `DELETE` route exists (`/api/schools/[id]/teacher-assignments/[assignmentId]`) for removing a single mistaken assignment. Never auto-carried-forward to a new session.

### `GradeHistory`
**Purpose**: a student's grade placement for one session — the permanent record. **Currently used**: yes, the central Phase 2 table.
**Key fields**: `id, studentId (FK), schoolGradeId (FK), academicSessionId (FK), status (default "ENROLLED"), enrolledAt, decidedAt?, decidedByUserId? (FK), outcomeGradeId? (FK to SchoolGrade)`. Valid `status`: `ENROLLED | COMPLETED | REPEATED | TRANSFERRED | LEFT`.
**Constraints**: `@@unique([studentId, academicSessionId])` — one placement per student per session.
**Delete behavior**: cascades from `Student`; **no delete route exists anywhere** — rows are permanent by design, a repeat or promotion creates a new row in the next session rather than editing this one.
**Critical rule**: `status`/`outcomeGradeId` may only ever be written through `recordGradeDecision()` (`src/lib/gradeHistory.ts`) — see [PRODUCT_RULES.md](PRODUCT_RULES.md).

### `GradeHistoryAudit`
**Purpose**: append-only log of every decision made on a `GradeHistory` row. **Currently used**: yes — one row per decision, verified 1:1 in multiple live tests.
**Key fields**: `id, gradeHistoryId (FK), changedByUserId (FK), changedAt, previousStatus, previousOutcomeGradeId?, newStatus, newOutcomeGradeId?`.
**Constraints**: none beyond FKs. `previousOutcomeGradeId`/`newOutcomeGradeId` are deliberately plain nullable strings, **not** live FK relations to `SchoolGrade` — a frozen snapshot, for the same reason `Certificate`'s `*NameSnapshot` fields are plain strings.
**Delete behavior**: cascades from `GradeHistory`; no update or delete route ever touches this table — `recordGradeDecision()` is the sole writer and only ever inserts.

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
- **No model in this schema has a working delete route in the application today** — every "delete behavior" described above is schema-level cascade behavior that would apply *if* a delete ever happened, not something any current UI action triggers (`TeacherGradeAssignment` is the one exception with a real `DELETE` route).
