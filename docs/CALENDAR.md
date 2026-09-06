# Calendar

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-07 (Calendar — Kilometer 1), against the current codebase.

## The fundamental concept ✅

Calendar is a **projection layer**, never a second source of truth. It aggregates already-authoritative data — General reference dates, School Events, Parent-Teacher Meetings, Homework due dates, Academic Session boundaries — into one shared, read-only shape (`CalendarItem`, `src/lib/calendar.ts`) for chronological display. No `CalendarEvent` database model exists; every item on Calendar is traceable back to the real row it came from.

```
GeneralCalendarEntry   Event   ParentTeacherMeeting   Homework   AcademicSession
        └───────────────┴──────────┬──────────┴───────────┴──────────┘
                         source-specific adapter functions
                                    ↓
                              CalendarItem[]
                                    ↓
                    merge, sort by (date, time), group by date
                                    ↓
                              CalendarAgenda
```

## General Calendar ✅

`GeneralCalendarEntry` (`prisma/schema.prisma`) is the one genuinely new authoritative source in this kilometer — national holidays and cultural/religious observances have no `schoolId`/`organizationId`-scoped home to belong to. Each row is a **concrete, already-resolved Gregorian-date occurrence** — "Dashain 2026" is its own row — never a recurrence rule. Nepal's calendar is lunar/Bikram-Sambat-based, so almost nothing repeats on a fixed Gregorian date year to year; re-entering next year's dates by hand, checked against the Nepal Panchanga Nirnayak Bikash Samiti's determination and the Ministry of Home Affairs' annual holiday gazette, is the deliberate design.

`bsDateDisplay` is a plain, unvalidated display string — nothing in this app queries, sorts, or computes from a Bikram Sambat value. `country` defaults to `"NP"` — not a region hierarchy, just forward-compatible enough to avoid hardcoding "always Nepal" in every query.

Seeded via `prisma/seed-general-calendar.ts` (`npm run db:seed:calendar`), idempotent by `(date, title)`. **Deliberately a separate script from `seed.ts`/`seed-demo.ts`** — this is real reference data meant to exist in every environment including a future production one, not fictional demo data.

⚠️ **The seeded K1 data currently covers only September–December 2026.** January–August 2026 were not found via the research pass that produced this seed and were deliberately left out rather than guessed — see the seed script's own file-level comment for the exact sourcing discipline. A follow-up curation pass is needed before this is a complete year.

## School Events ✅

`Event` (pre-existing model, previously had no write path at all — confirmed via a direct query that it held zero rows in every environment). Kilometer 1 adds:
- `isAllDay` — the **sole authoritative signal** for whether `startsAt` should be read as a real time or ignored for display. An all-day Event still stores a real timestamp (Kathmandu local midnight) purely because the column is non-nullable; rendering never infers meaning from that stored instant.
- `isActive` — soft-deactivate only, matching `Section`/`Subject`/`FamilyContact`'s existing convention. No `DELETE` route exists.
- `createdByUserId` — required, non-nullable (safe with zero pre-existing rows to backfill).
- `updatedAt`.
- `@@index([schoolId, startsAt])` — the actual query shape every K1 Calendar render uses.

**School-Admin-only creation** (`POST /api/schools/[id]/events`), mirroring `Opportunity`'s exact write-path shape. `organizationId` is never accepted from the client — Organization Events remain out of scope. No Teacher creation is authorized, matching every other institutional-content precedent (`NewsPost`, `Program`).

## Role-scoped aggregation ✅

| Role | Sees |
|---|---|
| School Admin | General, School Events, every meeting at the school, every homework due at the school, Academic Session boundaries |
| Teacher | General, School Events, their own meetings only, homework they authored, Academic Session boundaries |
| Student | General, School Events, their own published homework, Academic Session boundaries — **never** a Parent-Teacher Meeting |
| Parent | General, per-child School Events/homework/meetings, aggregated across every linked child |

Every rule above reuses existing, already-verified authorization exactly as it already worked — nothing here loosens or invents a permission. `fetchMeetingsForTeacher()`/`fetchMeetingsForStudent()` (`src/lib/academicProgress.ts`) are reused **completely unmodified**; their output is converted to `CalendarItem[]` by two small, separate converter functions (`teacherMeetingRowsToCalendarItems()`/`parentMeetingRowsToCalendarItems()`) that filter to the requested window in application code, since neither existing function has (or needed) an arbitrary date-range parameter. `fetchTodaysHomework()` is likewise untouched; `fetchHomeworkDueForStudent()` is a new sibling with the same placement-resolution logic, just widened from an exact-day match to a range.

## Multi-school ✅

School Admin/Teacher reach Calendar via `/dashboard/schools/[schoolId]/calendar`, gated by `verifySchoolAccess()` — the URL's `schoolId` is authoritative, re-checked fresh every request, exactly the Phase 4D pattern already proven by Attendance/Homework/Meetings/Teacher Today. No merged multi-school view exists. Student/Parent were never part of that migration, so `/dashboard/calendar` resolves their own scope directly from session identity — no schoolId in the URL, matching how their other dashboard features already work.

## Public Calendar ✅

`/calendar` shows General Calendar unconditionally (small, genuinely shared, safe to query without school-scoping) plus a **search-first** institutional section: a visitor searches for a school (a plain server-rendered form, no client component, no new API route — reusing the same `contains`-on-`name` idiom as `/api/schools/search`) and only then does a bounded, single-school Event query run. This replaces the previous implementation's unscoped `prisma.event.findMany({ take: 50 })` — which, with zero rows in every environment to date, had never actually been exercised at scale, but would have starved smaller schools out of visibility entirely once real data existed.

## Views ✅

Agenda/List only, grouped by date, "Today" visually distinguished. **No Month/Week/Day grid.** All-day items show no time; timed items show an explicit `Asia/Kathmandu`-anchored time, matching `TeacherTodayPanel`'s already-proven convention.

## Timezone discipline ✅

`kathmanduInstant()` (`src/lib/calendar.ts`) builds every real timestamp with an explicit `+05:45` offset — never the server's own local timezone. Date-only sources (`GeneralCalendarEntry.date`, `Homework.dueDate`, `AcademicSession.startDate`/`endDate`) are compared by calendar-day string, never converted to an instant.

## Explicitly out of scope for Kilometer 1 🔭

Organization Calendar (Organizations have no institutional-context parity with Schools yet — no affiliation-status table, no `verifyOrgAccess()`; building Organization Events now would either inherit that gap or require building the missing foundation first), personal (non-institutional) calendar items, recurring events, lunar-date computation, calendar sync/export, notifications, Month/Week/Day grid views, drag/drop, Attendance as a Calendar item, a distinct Exam category, Opportunity deadlines, category filters, a Platform Admin General Calendar management UI (managed by direct database/seed access for now), `Event.endsAt`, and any public/private visibility flag on `Event` (every K1 School Event is public by default, matching `NewsPost`/`Opportunity`'s existing precedent). See [KNOWN_GAPS.md](KNOWN_GAPS.md).
