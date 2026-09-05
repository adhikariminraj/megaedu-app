# MEGA ID

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-05 (Phase 4D — Institutional Identity & Relationship Architecture), against the current codebase.

## The core principle: MEGA ID belongs to the individual ✅

A MEGA ID is a `User` row — one email, one password, one identity. It is **not owned by a school, an organization, or any institution**. A school doesn't issue a MEGA ID to a student the way it might issue a library card; the person creates their own account, and *then* chooses to associate it with a school, an organization, or MEGA Academy. That association can change, end, or expand over time without the identity itself changing.

The doc comment above `authOptions` in `src/lib/auth.ts` states this plainly:

> "MEGA ID — one unified login for every role (School Admin, Teacher, Student, Parent, Organization Admin, Platform Admin). A single User can hold multiple roles at once (see UserRole in the Prisma schema); the session exposes all of them so the UI can show the right dashboards/actions without a second login."

## How a person relates to a School, an Organization, and MEGA Academy ✅

These are three separate, optional relationships a single `User` can hold simultaneously — none of them define the identity, they're attached to it:

- **School** — via a `Teacher` or `Student` profile, or via `SchoolAdmin`/`SchoolAccountant` join rows. The relationship itself is a row in `TeacherSchoolAffiliation`/`StudentSchoolAffiliation`, not a field on the account: a person can hold zero, one, or several such rows at once, each independently `PENDING`, `ACTIVE`, or `ENDED`, each carrying its own `startDate`/`endDate`. A Teacher is explicitly supported holding more than one simultaneous `ACTIVE` affiliation (multi-school teaching); Student simultaneous multi-school affiliation is schema-permitted but not yet a decided product policy (see [KNOWN_GAPS.md](KNOWN_GAPS.md)). `Teacher.schoolId`/`approved` and `Student.schoolId`/`approved` still exist as **transitional bridge fields** — kept in sync automatically only for the simple 0-or-1-open-affiliation case, deliberately left untouched (never guessed) once a person has 2+ affiliations — and are being phased out in favor of reading the affiliation table directly. See [ARCHITECTURE.md](ARCHITECTURE.md) and [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md) for the full lifecycle (JOIN/LEAVE/TRANSFER/REJOIN) and how an ACTIVE affiliation becomes an accessible, authorized school context.
- **Organization** — via `OrganizationAdmin`/`OrganizationAccountant` join rows, granting management access to a specific organization's courses and content.
- **MEGA Academy** — via `CourseEnrollment` rows, tied to the person's `Teacher` or `Student` profile, independent of which school (if any) that profile is affiliated with. Enrolling in a course has no relationship to school affiliation at all — an unaffiliated student can enroll in a free MEGA Academy course.

## Multiple roles on one identity ✅

Nothing in the schema or auth layer limits a `User` to one role. `UserRole` is a separate table (`@@unique([userId, role])`, not a single field on `User`), and a person can hold several roles at once — e.g. a Teacher at one school who is also a Parent of a student at another. See [USER_ROLES.md](USER_ROLES.md) for what each role actually grants and how the dashboard picks which one to show when a person has more than one.

## Registration is deliberately two-stage ✅

Every registration path creates a **minimal, single-role account first**; affiliation with a school/organization happens later, from the person's own dashboard. Two ways to register:

1. **Generic** (`POST /api/auth/register`) — name, email, password, one role. Teacher/Student/Parent get an unaffiliated profile immediately; School Admin/Organization Admin get nothing yet.
2. **Role-specific, single-step** — combines account creation with immediate affiliation (requires an already-verified school for Teacher/Student). Both this path and the direct-creation admin routes (Add Teacher/Add Student) create an ACTIVE `TeacherSchoolAffiliation`/`StudentSchoolAffiliation` row alongside the bridge field, not the bridge field alone (Phase 4A — "affiliation-complete" creation).

**Post-registration affiliation lifecycle routes**: `POST /api/teacher/{join-school,leave-school,transfer-school}`, `POST /api/student/{join-school,leave-school,transfer-school}`, `POST /api/parent/link-child`, `POST /api/schools/create-for-admin`, `POST /api/organizations/create-for-admin`. JOIN creates a `PENDING` affiliation; a School Admin approval (`POST /api/schools/[id]/{teachers,students}/[id]/approve`) flips it `ACTIVE`; LEAVE ends the current `ACTIVE` affiliation (`ENDED`, `endDate` set); TRANSFER ends the old one and creates a new `PENDING` one atomically (a thrown error rolls back the whole operation, never a half-applied transfer); REJOIN is simply another JOIN after a prior one ended. See [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md) for the full state machine.

## Learning history follows the person, not the school ✅

This is the practical consequence of the identity model, and it's structural, not just a policy statement:

- **`CourseEnrollment`** links to `Teacher.id`/`Student.id`, which link to `User.id` — a completed course and its resulting `Certificate` stay tied to the person regardless of what happens to their school affiliation afterward.
- **`GradeHistory`** (Phase 2) links to `Student.id` → `User.id`, the same way. A student's placement, promotion, and audit history exist independent of the school relationship — if a student later transfers or leaves (`TRANSFERRED`/`LEFT` in `GradeHistory.status`), their historical `GradeHistory` rows from that school are never deleted; the record simply notes they left, permanently.
- **`Certificate.recipientUserId`** + `recipientMegaIdSnapshot` — a certificate belongs to the recipient's MEGA ID, frozen at issuance, and is reachable by that person regardless of which organization issued it or what that organization is called today.

## Authentication ✅

NextAuth Credentials provider: email + password, `bcrypt.compare` against `User.passwordHash`. JWT session strategy (not database sessions). Full detail in [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md).

## Where MEGA ID surfaces elsewhere ✅

- **Certificates** — `Certificate.recipientMegaIdSnapshot` freezes the recipient's `User.id` at issuance and is displayed as `MEGA ID: {id}` on the certificate.
- **Instructor** — deliberately *not* required to have a MEGA ID (`Instructor.megaIdUserId` is optional) — a person can be credited on a course/certificate by name alone before ever creating an account.

## What's absent 🔭

- No OAuth/SSO providers — Credentials is the only one configured.
- No email verification at registration.
- No password reset / forgot-password flow.
- No rate limiting on login or registration.
- No account deactivation/deletion flow anywhere in the app.
