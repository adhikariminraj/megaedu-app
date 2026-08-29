# Authentication & Authorization

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29 (Phase 3A), against the current codebase.

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
| `requireSchoolAdmin(schoolId)` | Session + a `SchoolAdmin` row for `(userId, schoolId)` | Every `/api/schools/[id]/*` write route, including all Phase 2 routes: `academic-sessions`, `academic-sessions/rollover`, `grades`, `teacher-assignments`, `grade-placements`, `grade-decisions`, `grade-rollover` |
| `requireOrgAdmin(organizationId)` | Session + an `OrganizationAdmin` row | Every `/api/organizations/[id]/*` write route |
| `requireCourseOwner(courseId)` | Resolves the course → its `organizationId` → org-admin check | Course content routes (modules, lessons, publish toggle) |
| `requirePlatformAdmin()` | Session + `roles.includes("PLATFORM_ADMIN")` | Everything under `/admin` and `/api/admin/*` |
| `requireSchoolFinance(schoolId)` | Session + (`SchoolAdmin` row **or** `SchoolAccountant` row) | Finance-only routes/tabs for a school |
| `requireOrgFinance(organizationId)` | Session + (`OrganizationAdmin` row **or** `OrganizationAccountant` row) | Finance-only routes/tabs for an organization |

**Deliberate design note** (see [PRODUCT_RULES.md](PRODUCT_RULES.md)): the finance helpers check *both* the Admin and Accountant relationships on purpose — an Admin keeps full authority (finance included), a bare Accountant gets finance access *only*.

## Teacher academic authorization — `requireTeacherAssignment()` ✅ (built, no caller yet)

Added in Phase 3A, alongside the `requireX` suite but with a different shape — it checks a *specific academic assignment*, not a blanket school-wide relationship:

```ts
requireTeacherAssignment(
  schoolId: string,
  scope: { academicSessionId: string; schoolGradeId: string; sectionId?: string | null; subjectId?: string }
): Promise<string | null>
```

Resolves the caller's own approved `Teacher` row at `schoolId`, then checks for a `TeacherAcademicAssignment` matching `academicSessionId` + `schoolGradeId`, where a grade-wide assignment (`sectionId: null` on the row) satisfies any `scope.sectionId` given — a grade-wide row always "covers" every section, matching how sections work everywhere else in this schema. `scope.sectionId`/`scope.subjectId` are both optional, so the same primitive expresses either a broad "assigned here at all" check or a narrow "assigned to teach *this subject* here" check.

**No route calls this yet** — it's the Phase 3A foundation for Phase 3B's attendance, homework, teaching-progress, and units/lessons work. Deliberately teacher-only, no School-Admin bypass baked in; a future caller wanting "Admin or the assigned Teacher" composes both checks inline, the same way `students/[studentId]/skills` already combines an inline teacher check with `requireSchoolAdmin`. See [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md) and [PRODUCT_RULES.md](PRODUCT_RULES.md).

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
