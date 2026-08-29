# Authentication & Authorization

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29 (Phase 3B, plus School Admin Direct Student & Teacher Management), against the current codebase.

## Login / MEGA ID authentication ✅

**`src/lib/auth.ts`** — NextAuth (`next-auth` v4) with a single `CredentialsProvider` ("MEGA ID"): email + password, `bcrypt.compare` against `User.passwordHash`. `PrismaAdapter` is attached, but session strategy is **JWT**, not database sessions.

- `jwt` callback: on sign-in, copies `id` and `roles` (the array of `UserRole.role` strings) onto the token.
- `session` callback: copies `id` and `roles` from the token onto `session.user`.
- `pages.signIn: "/login"` — a custom login page.

## Session handling ✅

Every server-side check reads the session the same way:

```ts
const session = await getServerSession(authOptions);
const userId = (session?.user as any)?.id;
const roles = (session?.user as any)?.roles;
```

The `as any` casts exist because `next-auth`'s default `Session["user"]` type doesn't know about `id`/`roles`. `src/types/next-auth.d.ts` exists as the ambient-type augmentation point, though the inline casts are still used throughout rather than relying on it everywhere.

## Role checks ✅

The simplest form — `roles?.includes("SCHOOL_ADMIN")` — is used where there's no specific resource to check against (e.g. gating who's allowed to create a school via `create-for-admin`). For anything scoped to a specific school/organization/course, a `requireX` helper is used instead (below).

## School / Organization / Finance / Platform authorization — the `requireX` helper suite ✅

**`src/lib/authorize.ts`** — every write route that needs "does this session have permission to act on this specific resource" calls one of these, rather than inlining the check. Each returns the authorized `userId` or `null` (never throws).

| Function | Checks | Used for |
|---|---|---|
| `requireSchoolAdmin(schoolId)` | Session + a `SchoolAdmin` row for `(userId, schoolId)` | Every `/api/schools/[id]/*` write route, including all Phase 2 routes: `academic-sessions`, `academic-sessions/rollover`, `grades`, `teacher-assignments`, `grade-placements`, `grade-decisions`, `grade-rollover`, and the direct-creation routes `POST students` (Add Student) and `POST teachers` (Add Teacher) |
| `requireOrgAdmin(organizationId)` | Session + an `OrganizationAdmin` row | Every `/api/organizations/[id]/*` write route |
| `requireCourseOwner(courseId)` | Resolves the course → its `organizationId` → org-admin check | Course content routes (modules, lessons, publish toggle) |
| `requirePlatformAdmin()` | Session + `roles.includes("PLATFORM_ADMIN")` | Everything under `/admin` and `/api/admin/*` |
| `requireSchoolFinance(schoolId)` | Session + (`SchoolAdmin` row **or** `SchoolAccountant` row) | Finance-only routes/tabs for a school |
| `requireOrgFinance(organizationId)` | Session + (`OrganizationAdmin` row **or** `OrganizationAccountant` row) | Finance-only routes/tabs for an organization |

**Deliberate design note** (see [PRODUCT_RULES.md](PRODUCT_RULES.md)): the finance helpers check *both* the Admin and Accountant relationships on purpose — an Admin keeps full authority (finance included), a bare Accountant gets finance access *only*.

**Verified live**: a logged-in, non-admin Teacher (`demo.teacher@megaedu.local`) sent direct `fetch()` requests to `POST students`, `POST teachers`, and `POST grade-placements` — all three correctly returned `403 {"error": "Forbidden"}`, and a database check afterward confirmed zero accounts/rows were created despite the attempts. Confirms `requireSchoolAdmin` is enforced server-side on these routes independent of the UI, the same standard already established for every other write route in this table.

## Teacher academic authorization — `requireTeacherAssignment()` and `requireClassTeacher()` ✅

`requireTeacherAssignment()` was added in Phase 3A, alongside the `requireX` suite but with a different shape — it checks a *specific academic assignment*, not a blanket school-wide relationship:

```ts
requireTeacherAssignment(
  schoolId: string,
  scope: { academicSessionId: string; schoolGradeId: string; sectionId?: string | null; subjectId?: string }
): Promise<string | null>
```

Resolves the caller's own approved `Teacher` row at `schoolId`, then checks for a `TeacherAcademicAssignment` matching `academicSessionId` + `schoolGradeId` (+ `subjectId` if given). `scope.sectionId` follows **three distinct states**, via a shared `sectionScopeWhere()` helper — this is a Phase 3B correction to the original Phase 3A code, made before the function had any real caller:

- **omitted**: no section restriction — matches any assignment for the grade/subject regardless of section.
- **`null`**: the target itself is grade-wide (e.g. a grade-wide `TeachingUnit`) — requires a grade-wide assignment *specifically*; a section-specific-only teacher does not pass.
- **a real section id**: the target is one specific section — a grade-wide assignment (covers every section) or that exact section's assignment both satisfy it.

The original implementation treated `null` and *omitted* identically (both are falsy in JS), which never mattered while nothing called it, but would have wrongly authorized a section-specific-only teacher to manage a grade-wide unit once Phase 3B started depending on it. Verified independently against real assignment data (six scenarios, including the specific `null`-requires-grade-wide case) *before* any Teaching Unit/Test route was built on top of it.

`requireClassTeacher()`, new in Phase 3B, checks a `ClassTeacherAssignment` (Grade Class Teacher / Section Teacher) with the identical three-way `sectionId` semantics, via the same `sectionScopeWhere()` helper:

```ts
requireClassTeacher(
  schoolId: string,
  scope: { academicSessionId: string; schoolGradeId: string; sectionId?: string | null }
): Promise<string | null>
```

Both gate Phase 3B's operational routes: `requireTeacherAssignment()` for Teaching Units, Teaching Plans, and Unit/Chapter Tests (scoped to the unit/plan/test's own grade/section/subject); `requireClassTeacher()` for Attendance (scoped to the grade/section being marked — passing `sectionId: null` when marking the whole grade correctly requires a Grade Class Teacher, not just any Section Teacher). Verified live through a real logged-in Section Teacher account: marking their own section succeeded, marking a different section or the whole grade unscoped both returned `403`.

Both are deliberately teacher-only, no School-Admin bypass baked in; a caller wanting "Admin or the assigned Teacher" composes both checks inline, the same way `students/[studentId]/skills` already combines an inline teacher check with `requireSchoolAdmin`, and every Phase 3B write route does the same (`requireSchoolAdmin(...) || requireClassTeacher(...)` / `requireTeacherAssignment(...)`). See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md), [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md), and [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Access patterns not covered by `authorize.ts` ✅

Some checks are simple/specific enough to stay inlined rather than factored into a shared helper:

- **Certificate preview access** — `certificate.recipientUserId === userId || roles.includes("PLATFORM_ADMIN")`, inlined in the page.
- **Course enrollment/completion ownership** — `enrollment.teacher?.userId === userId || enrollment.student?.userId === userId`, inlined per route.
- **Promotion roster's closed-session access** (Phase 2) — `/dashboard/grades/[schoolGradeId]?session=<id>` resolves the target session (active by default, or the specific one given) and validates it belongs to the requester's own school via the same School Admin resolution the page already does; the underlying write (`recordGradeDecision()`) doesn't care about session status at all.

## Platform administration ✅

`requirePlatformAdmin()` gates `/admin/schools`, `/admin/organizations`, `/api/admin/schools/[id]/verify`, `/api/admin/organizations/[id]/verify`, and the Platform Admin dashboard branch of `dashboard/page.tsx`.

## What's absent 🔭

- No rate limiting on login, registration, or any other route.
- No CSRF protection beyond what NextAuth provides for its own endpoints.
- No session revocation mechanism (JWT sessions live until expiry; no server-side "log out everywhere").
- No audit log of authorization *decisions* (as distinct from the data-level `GradeHistoryAudit` trail for grade decisions specifically — see [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md)).
