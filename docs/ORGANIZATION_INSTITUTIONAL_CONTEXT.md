# Organization Institutional Context

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-10, against the current codebase.

## Why this exists ✅

[INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md) covers how a person's relationship to a *School* is resolved and authorized. Organization had no equivalent — `dashboard/page.tsx`'s `ORGANIZATION_ADMIN` branch picked an organization with a plain `organizationAdmin.findFirst({ userId })`, arbitrarily, with no way to even discover that a person administers more than one. This document covers the foundation kilometer that closed that specific gap, following the Organization Institutional Context design report's approved **Option A**.

## `User` remains the sole identity anchor ✅

Unchanged by this kilometer. `OrganizationAdmin.userId` and `OrganizationAccountant.userId` are, and remain, direct `User` foreign keys — no intermediate profile entity sits between a person and their organization role, matching the same principle already established for Academy participation (`CourseEnrollment.userId`, see [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md)).

## `OrganizationAdmin`/`OrganizationAccountant` remain the authoritative context — no new model ✅

**Deliberately no schema change.** `OrganizationAdmin` and `OrganizationAccountant` — flat join rows, `{id, userId, organizationId}`, no status, no history, no dates — remain exactly as they were and remain the single source of truth for "who has institutional access to this Organization." The design report evaluated and explicitly rejected a generalized `OrganizationMembership{role}` table: nothing in the codebase queries "all my organization roles regardless of type" as a single list (Admin and Accountant already render through two entirely separate dashboard components), so unifying the tables would have added real migration cost — rewriting the `@@unique([userId,organizationId])` constraint, four call sites, and seed data — for no demonstrated functional gain. **Intentionally deferred**, not forgotten.

This mirrors an existing, proven precedent in this exact codebase: `SchoolAdmin`/`SchoolAccountant` are equally flat and historyless, and are already a first-class input to `getAccessibleSchools()` alongside the much richer `TeacherSchoolAffiliation`. Organization's admin/accountant layer isn't "one generation behind School's" — School's own administrative-role tables never got a history upgrade either. Only School's Teacher/Student *affiliation* layer did, because that relationship gates real academic authority (grade placement, subject assignment) and needs a `PENDING`→`ACTIVE` approval workflow. No equivalent need is evidenced for Organization Admin/Accountant grants — see the design report, §5/§8.

## `getAccessibleOrganizations()` — the resolver ✅

`src/lib/institutionalContext.ts`:

```ts
getAccessibleOrganizations(userId: string): Promise<{ organizationId: string; organizationName: string; role: "ORGANIZATION_ADMIN" | "ORGANIZATION_ACCOUNTANT" }[]>
```

Unions every `OrganizationAdmin` link with every `OrganizationAccountant` link for the user — directly mirroring `getAccessibleSchools()`'s union of `SchoolAdmin` with ACTIVE `TeacherSchoolAffiliation`. A user who is Admin of one organization and Accountant of another gets both entries, correctly labeled. Ordered by `id` for deterministic output (`OrganizationAdmin`/`OrganizationAccountant` have no `createdAt` field — schema unchanged, per the approved kilometer — so `id` order is the available deterministic substitute). Display/routing input only, exactly like its School counterpart — never itself a security decision.

## `verifyOrgAccess()` — the gate ✅

```ts
verifyOrgAccess(userId: string, organizationId: string): Promise<{ role: "ORGANIZATION_ADMIN" } | { role: "ORGANIZATION_ACCOUNTANT" } | null>
```

A fresh, explicit-`organizationId`, fail-closed lookup — checks `OrganizationAdmin` first, then `OrganizationAccountant`, returns `null` for no relationship at all with that specific organization. This is an **institutional-context gate, not a replacement** for the existing role/resource-specific helpers:

- `requireOrgAdmin(organizationId)` — unchanged, still the gate for admin-only writes (course/opportunity creation, accountant management).
- `requireCourseOwner(courseId)` — unchanged, still resolves a course's `organizationId` and checks `requireOrgAdmin` against it.
- `requireOrgFinance(organizationId)` — unchanged, still unwired, still zero call sites. Deliberately not activated or deleted by this kilometer — it remains pre-built scaffolding for a future Payments kilometer (`Subscription`/`Payment` still have no `organizationId` column at all).

`verifyOrgAccess()` is not yet called by any route in this kilometer — it's foundation for future organization-scoped gates (e.g. a future URL-scoped dashboard route), added now because the resolver and the gate are the same architectural layer and were approved together.

**The global `UserRole` flag (`ORGANIZATION_ADMIN`/`ACCOUNTANT`) is never authorization** — it's a coarse routing hint only (`dashboard/page.tsx`'s `roles?.includes(...)` branch selection), exactly as it already was for School. Every access decision that matters checks the organization-scoped join row, via `getAccessibleOrganizations()`/`verifyOrgAccess()` or the existing `requireX()` helpers — never the global flag alone.

## Dashboard resolution — arbitrary pick corrected ✅

`src/app/dashboard/page.tsx`'s `ORGANIZATION_ADMIN` branch:

- **0 accessible organizations** — unchanged: `CreateOrgPrompt`.
- **1 accessible organization** — unchanged behavior, now resolved via `getAccessibleOrganizations()` instead of `findFirst()`: `OrgDashboard`, same query shape, same props.
- **2+ accessible organizations** — the arbitrary silent pick is gone. Replaced with an explicit, **non-interactive** boundary page listing every accessible organization by name. No org is rendered, no course-creation form is shown, nothing is silently chosen. **This is intentionally not a chooser** — no `OrganizationChooser` component, no preference cookie, no URL-scoped `/dashboard/organizations/[id]` route were built. That UX (which of several credible shapes — a parallel component mirroring `SchoolChooser`, or a URL-scoped route matching School's own routing convention) is a separate, not-yet-approved decision. See [KNOWN_GAPS.md](KNOWN_GAPS.md).

The `ACCOUNTANT` branch (`AccountantDashboard.tsx`) already correctly listed every accessible school/org via `findMany` before this kilometer — it was never affected by the bug and is unchanged.

## Accountant revoke ✅

`DELETE /api/organizations/[id]/accountants/[userId]` — the smallest capability closing a real, confirmed gap: a grant path for `OrganizationAccountant` existed with no matching revoke path. Gated by the existing `requireOrgAdmin(params.id)` — never by the global `UserRole` flag alone. Deletes only the `OrganizationAccountant` join row (via its own `@@unique([userId, organizationId])` key, the same idiom already used for `SchoolApproach` removal) — never the target `User`, the `Organization`, or their global `ACCOUNTANT` role flag (which may still be earned/needed elsewhere, e.g. a School accountant grant). No history or status is recorded — matching `SchoolAdmin`/`SchoolAccountant`'s existing plain-delete precedent; nothing in this codebase consumes org-role removal history.

## What's intentionally deferred 🔭

- **The 2+-organization chooser UX** — explicitly out of scope for this kilometer; needs its own approval.
- **Granting a second Admin to an existing organization** — no such route exists at all today (an organization can only ever get its first admin, at creation). A real, confirmed gap, deliberately not addressed here.
- **Revoking `OrganizationAdmin` access** — deferred until co-admin grant exists (a sole admin removing themselves would orphan the organization — a product question, not an architecture one).
- **`OrganizationMembership`/unified-role table** — evaluated and rejected (see above); not needed for any currently demonstrated case.
- **History/status/`effectiveFrom`-`effectiveTo` fields on `OrganizationAdmin`/`OrganizationAccountant`** — not needed; nothing would consume them.
- **`requireOrgFinance()` activation** — remains unwired until a real Payments kilometer.
- **Organization profile editing** (`PATCH /api/organizations/[id]`) — a separate, smaller capability gap, not part of this kilometer.
- **Generalized audit-trail architecture** spanning School/Organization/Academy — future work, not designed or started here.
