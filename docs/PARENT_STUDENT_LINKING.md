# Parent-Student Linking

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-10, against the current codebase.

## Why this exists ✅

Before the Parent-Student Linking Trust Boundary kilometer, `POST /api/parent/link-child` and `POST /api/auth/register-parent` both granted a Parent full, immediate access to a Student's Homework, Report Card, Mark Sheet, and Academic Snapshot data the moment the Parent supplied the Student's account email — no confirmation, no notification, no way to undo. This document covers the fix: **`ParentStudent.confirmedAt`** is the only new state, and the Student themselves is the one who confirms.

## The model ✅

`ParentStudent` is unchanged in shape except for one additive, nullable field:

```prisma
model ParentStudent {
  id          String    @id @default(cuid())
  parentId    String
  studentId   String
  parent      Parent    @relation(fields: [parentId], references: [id], onDelete: Cascade)
  student     Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  confirmedAt DateTime?

  @@unique([parentId, studentId])
}
```

- `confirmedAt: null` — a request exists but grants **no** access anywhere.
- `confirmedAt` set — confirmed; exactly today's Parent access, unchanged from before this kilometer.

**Deliberately not built**: a `PENDING`/`ACTIVE`/`ENDED`/`REJECTED` status enum, `initiatedBy`/`respondedAt` timestamps, an audit table, or a separate request model. None has an identified consumer — this relationship is a personal/family one, not an institutional affiliation, and doesn't need `TeacherSchoolAffiliation`'s richer lifecycle. See the design report referenced in the schema's own doc comment for the full reasoning.

## Creating a request ✅

Two entry points, both behaving identically — create with `confirmedAt: null`, never immediate access:

- **`POST /api/parent/link-child`** — an already-authenticated Parent adds a child. Idempotent: an existing row (pending or confirmed) is never re-created or reset — `alreadyLinked: true` if already confirmed, `alreadyRequested: true` if already pending.
- **`POST /api/auth/register-parent`** — the more permissive, unauthenticated path (registers a brand-new Parent account and requests a link in one step). Same `confirmedAt: null` treatment.

Both notify the Student (`PARENT_LINK_REQUESTED`, `src/lib/notify.ts`) — a plain FYI ping, not itself actionable (see below).

## Confirming ✅

**`POST /api/parent-student/[id]/confirm`** — Student-only. The authenticated user must be the exact Student party to that row (`link.student.userId === userId`), re-checked fresh every call. Sets `confirmedAt: now()`. Idempotent if already confirmed (no-op success, timestamp untouched — this route only ever moves `null` → a timestamp, never backwards). `403` for any other user, `404` for a nonexistent row.

## Declining / unlinking ✅

**`DELETE /api/parent-student/[id]`** — one route, serving three cases identically, because they're the same operation (hard delete):

- A pending row, deleted by the Student → **decline**.
- A pending row, deleted by the Parent who requested it → **cancel**.
- A confirmed row, deleted by either party → **unlink**.

Authorization is solely "the caller is the Parent or the Student of *this exact row*" — never a School Admin, an Organization Admin, or anyone else; no institutional authority mediates this relationship. `403` for any unrelated user, `404` for a nonexistent row. No `ENDED`/`REJECTED` state is retained — deleting is deleting, matching the `OrganizationAccountant` revoke precedent (see [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md)) — nothing in this codebase consumes "past linked parents" history.

## Authorization — every site now requires `confirmedAt: { not: null }` ✅

Five sites, all previously gated on mere row existence, all now gated on confirmation:

1. `src/lib/homeworkAuthorization.ts` (`resolveApplicabilityAccess`) — Homework/Submission/Review.
2. `src/app/dashboard/report-card/[studentId]/page.tsx` — Report Card.
3. `src/app/dashboard/mark-sheet/[studentId]/page.tsx` — Mark Sheet index.
4. `src/app/dashboard/mark-sheet/[studentId]/[markSheetId]/page.tsx` — Mark Sheet document.
5. `src/app/dashboard/page.tsx`'s `PARENT` branch — the Academic Snapshot bundle (attendance %, homework completion %, overall performance, admission number, meetings, today's homework), via `Parent.children` now filtered to `confirmedAt: { not: null }`.

None of these five had their surrounding logic changed beyond that one added clause — a pending relationship behaves exactly like no relationship at all (redirect/empty state), a confirmed one behaves exactly like it always did.

## Student UX ✅

`Notification.type` has no structured payload field, so the `PARENT_LINK_REQUESTED` notification itself can't carry "which request" — extending `Notification` for this would be an unrelated schema change, explicitly out of scope. Instead, `StudentDashboard.tsx` queries `ParentStudent` directly (`confirmedAt: null` for this student — the single source of truth, not derived from the notification) and renders a small **Parent Requests** panel (`src/components/PendingParentRequests.tsx`) with Confirm/Decline buttons, shown regardless of whether the Student has a school yet.

## Parent UX ✅

`LinkChildPrompt.tsx` now shows a plain success message after requesting — "Request sent — your child needs to confirm it..." — rather than silently refreshing as if access were already granted. `ParentDashboard.tsx` itself required no changes: it already rendered a correct empty state ("Link your child to get started") for zero children, which is exactly what a Parent with only pending requests now sees.

## Migration ✅

23 pre-existing `ParentStudent` rows were reviewed before this kilometer's migration. 18 were confirmed to be test residue (6 students × 3 duplicate throwaway parent accounts each, created across three separate manual-testing passes on 2026-09-01 and 2026-09-07 — no seed script ever created a `ParentStudent` row) and were deleted, a separate, explicitly user-approved data change. The remaining 5 legitimate rows were grandfathered: `confirmedAt` set to one deterministic migration timestamp (2026-09-10T00:00:00.000Z) rather than retroactively demanding confirmation, since there's no way to obtain genuine retroactive consent and disrupting real existing family relationships would be a regression, not a security improvement. The risk this kilometer closes is about **new** links going forward.

## What's explicitly deferred 🔭

- Any `FamilyContact` changes.
- A general notification-system redesign — `PARENT_LINK_REQUESTED` is one narrowly-scoped addition, not a new architecture.
- Any School- or Organization-mediated approval — evaluated and rejected; this relationship has no institutional context.
- A generalized audit/history framework for this or any other relationship.
- A broader Parent-domain management page — the Confirm/Decline panel is deliberately minimal, not a relationship-management subsystem.
