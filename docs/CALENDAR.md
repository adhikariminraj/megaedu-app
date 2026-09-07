# Calendar

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-07 (Calendar — Kilometer 1.2), against the current codebase.

## The fundamental concept ✅

Calendar is a **projection layer**, never a second source of truth. It aggregates already-authoritative data — General reference dates, School Events, Parent-Teacher Meetings, Homework due dates, Academic Session boundaries, and (Kilometer 1.1) SchoolCalendarEntry — into one shared, read-only shape (`CalendarItem`, `src/lib/calendar.ts`) for display. No `CalendarEvent` database model exists; every item on Calendar is traceable back to the real row it came from.

```
GeneralCalendarEntry  Event  ParentTeacherMeeting  Homework  AcademicSession  SchoolCalendarEntry
        └──────────────┴─────────────┬─────────────┴──────────┴────────────────────┘
                         source-specific adapter functions
                                    ↓
                              CalendarItem[]  ◄── separate: resolveDayStatuses() ──► Map<date, DayStatus>
                                    ↓                                                      ↓
                    merge, sort by (date, time), group by date              Annual view's cell background
                                    ↓
                         CalendarAnnual  /  CalendarAgenda
```

Kilometer 1.1 introduced a second, deliberately independent layer — **Day Status** ("what kind of day is this?") — which never merges into `CalendarItem` ("what happens on this day?"). See "Day Status vs Activities" below.

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

## SchoolCalendarEntry ✅ (Kilometer 1.1)

A school-scoped counterpart to `GeneralCalendarEntry`, covering six categories in one model — `startDate`/`endDate` form an inclusive date range (equal to each other for a point activity):

| Category | Shape | Sets Day Status? |
|---|---|---|
| `VACATION` | range | yes |
| `EXAMINATION` | range | yes |
| `SPECIAL_CLOSURE` | range | yes |
| `PTM` | single date | no |
| `RESULT_DAY` | single date | no |
| `REPORT_CARD_DISTRIBUTION` | single date | no |

`affectsDayStatus` is **never client-editable** — `resolveSchoolCalendarEntryDates()` (`src/lib/schoolCalendar.ts`) derives it purely from `category`, and also validates the date shape (`startDate <= endDate` for a range; a single `date` for a point activity), on both create and edit. The Admin UI (`SchoolCalendarManager.tsx`) doesn't even expose `affectsDayStatus` as a field.

Deliberately **not** where individual `ParentTeacherMeeting` appointments, `UnitTest` dates, or `AssessmentPeriod` live — a `PTM` row here represents the school-wide *planned* date ("First PTM is March 20"), never a specific family's appointment; those stay exactly where K1 left them.

School-Admin-only write path (`POST`/`PATCH /api/schools/[id]/school-calendar[/entryId]`), soft-deactivate only (no `DELETE`), mirroring `Event`'s exact write-path shape.

## Day Status vs Activities ✅ (Kilometer 1.1)

Two deliberately separate concepts, never collapsed into one:

- **Day Status** — "what kind of day is this?" One resolved value per date (`SPECIAL_CLOSURE | EXAMINATION | VACATION | PUBLIC_HOLIDAY | WEEKLY_HOLIDAY`, or none = a regular day), computed by `resolveDayStatuses(schoolId, window)` (`src/lib/schoolCalendar.ts`) from `SchoolCalendarEntry` ranges, `GeneralCalendarEntry` rows where `type === "NATIONAL_HOLIDAY"` only, and a computed weekly holiday (Saturday, hardcoded — no `School` field, no per-school configuration in this kilometer). **`OBSERVANCE`/`MEGA_WIDE_EVENT` General Calendar entries never set a Day Status** — an observance never implies school is closed. Controls only the Annual view's cell background.
- **Color families (Kilometer 1.2)** — the original K1.1 palette (several pale, near-identical neutrals) proved too subtle in a dense annual grid; each status now gets its own genuinely distinct color family, not just a different shade: Public Holiday → blue (`bg-blue-100`), Vacation → green/emerald (`bg-emerald-100`), Examination → amber/orange (`bg-amber-200`), Weekly Holiday → slate/gray (`bg-slate-100`, the lightest of the four since it recurs every week), Special Closure → rose/red (`bg-rose-100`). A Vacation/Examination range renders as one continuous rounded band across its date span, computed purely from neighboring dates in the already-resolved map — no separate range metadata is stored. The legend (see Views below) uses the same colors as circular swatches, never a separate palette of its own.
- **Activities** — "what happens on this day?" The existing `CalendarItem[]` projection, unchanged in shape, now including `SchoolCalendarEntry`-sourced items too.

Overlapping statuses resolve to exactly **one** dominant value via a fixed priority order (`SPECIAL_CLOSURE > EXAMINATION > VACATION > PUBLIC_HOLIDAY > WEEKLY_HOLIDAY`) — no blended/dual-color treatment. A Parent whose linked children attend different schools gets each school's statuses resolved independently and then merged with that same priority (`mergeDayStatuses()`).

## Role-scoped aggregation ✅

| Role | Sees |
|---|---|
| School Admin | General, School Events, School Calendar (Vacation/Examination/PTM/Result Day/Report Card), every meeting at the school, every homework due at the school, Academic Session boundaries |
| Teacher | General, School Events, School Calendar, their own meetings only, homework they authored, Academic Session boundaries |
| Student | General, School Events, School Calendar, their own published homework, Academic Session boundaries — **never** a Parent-Teacher Meeting |
| Parent | General, per-child attribution on Homework/Meetings, aggregated across every linked child; School Events/Academic Session/School Calendar fetched once per **distinct school**, never once per child (two siblings at the same school must not double up that school's Events/Vacation/Exam dates) |

Every rule above reuses existing, already-verified authorization exactly as it already worked — nothing here loosens or invents a permission. `fetchMeetingsForTeacher()`/`fetchMeetingsForStudent()` (`src/lib/academicProgress.ts`) are reused **completely unmodified**; their output is converted to `CalendarItem[]` by two small, separate converter functions (`teacherMeetingRowsToCalendarItems()`/`parentMeetingRowsToCalendarItems()`) that filter to the requested window in application code, since neither existing function has (or needed) an arbitrary date-range parameter. `fetchTodaysHomework()` is likewise untouched; `fetchHomeworkDueForStudent()` is a new sibling with the same placement-resolution logic, just widened from an exact-day match to a range.

## Parent child attribution ✅ (Kilometer 1.1)

`CalendarItem` carries two optional fields, `childId`/`childName`, populated **only** by the Parent Calendar's own per-child loop (`src/app/dashboard/calendar/page.tsx`), for genuinely per-student sources — `fetchHomeworkDueForStudent()` and `parentMeetingRowsToCalendarItems()` — never for school-wide sources (`Event`, `AcademicSession`, `SchoolCalendarEntry`), which stay attribution-free even in the Parent view (a "First PTM" date isn't "Anita's," it's the whole school's). The underlying Homework/Meeting rows and their Teacher/Admin/Student call sites are unmodified — the parameter is optional and simply absent everywhere else.

Because a single Homework row can legitimately project into more than one `CalendarItem` (two siblings in the same grade/section both get it), its `CalendarItem.id` incorporates the child id (`Homework:<id>:<childId>`) when attributed — otherwise two items would collide on the same React/list key. `ParentTeacherMeeting` doesn't need this: a meeting row is inherently about one specific student already, so no two children can ever share one meeting row.

## Event edit / deactivate ✅ (Kilometer 1.1)

`CalendarEventForm.tsx` now also lists the school's own upcoming Events with **Edit** and **Deactivate** actions, using the write path's existing `PATCH` route (`isActive:false` — no `DELETE`). Deliberately kept out of `CalendarAnnual`/`CalendarAgenda`, which stay display-only and are shared by every role; this is the one place Admin-only Event mutation lives. `SchoolCalendarEntry` gets the identical treatment in its own separate component, `SchoolCalendarManager.tsx`.

## Calendar item links ✅ (Kilometer 1.1)

Only real, already-existing destinations — nothing invented:

| Source | Link | Audience |
|---|---|---|
| Homework | `/dashboard/schools/[schoolId]/homework` | Teacher, Admin only |
| ParentTeacherMeeting | `/dashboard/meetings?teacher=<id>` | Teacher, Admin only (staff-only route) |
| SchoolCalendarEntry `RESULT_DAY`/`REPORT_CARD_DISTRIBUTION` | `/dashboard/report-card/[studentId]` | Student (own), Parent (per child) |
| Everything else (School Event, Vacation/Examination/PTM, General Calendar, Academic Session) | none | — no real destination page exists yet |

## Multi-school ✅

School Admin/Teacher reach Calendar via `/dashboard/schools/[schoolId]/calendar`, gated by `verifySchoolAccess()` — the URL's `schoolId` is authoritative, re-checked fresh every request, exactly the Phase 4D pattern already proven by Attendance/Homework/Meetings/Teacher Today. No merged multi-school view exists. Student/Parent were never part of that migration, so `/dashboard/calendar` resolves their own scope directly from session identity — no schoolId in the URL, matching how their other dashboard features already work.

## Public Calendar ✅

`/calendar` shows General Calendar unconditionally (small, genuinely shared, safe to query without school-scoping) plus a **search-first** institutional section: a visitor searches for a school (a plain server-rendered form, no client component, no new API route — reusing the same `contains`-on-`name` idiom as `/api/schools/search`) and only then does a bounded, single-school Event query run. This replaces the previous implementation's unscoped `prisma.event.findMany({ take: 50 })` — which, with zero rows in every environment to date, had never actually been exercised at scale, but would have starved smaller schools out of visibility entirely once real data existed.

## Views ✅

**Annual** (default) — 12 static month cards (`CalendarAnnual.tsx`), computed with `Date.UTC`-based grid math (`src/lib/monthGrid.ts`), never a manually-constructed date. Each cell shows the Day Status background (see "Color families" above) plus the existing per-item number/dot activity treatment on top. A restrained, always-visible legend (circular color swatches, matching the cell colors exactly) explains the four Day Status colors. **Agenda** — the original chronological list (`CalendarAgenda.tsx`, unchanged), kept to its own concise ~30-day upcoming window (`CalendarView.tsx`) regardless of how wide the Annual view's shared fetch is — both views render from the exact same fetched `CalendarItem[]`, no second query. Neither is an interactive drag/drop scheduling grid — both stay read-only, matching the "educational calendar, not a generic calendar platform" goal. All-day items show no time; timed items show an explicit `Asia/Kathmandu`-anchored time, matching `TeacherTodayPanel`'s already-proven convention.

## Timezone discipline ✅

`kathmanduInstant()` (`src/lib/calendar.ts`) builds every real timestamp with an explicit `+05:45` offset — never the server's own local timezone. Date-only sources (`GeneralCalendarEntry.date`, `Homework.dueDate`, `AcademicSession.startDate`/`endDate`) are compared by calendar-day string, never converted to an instant.

## Explicitly out of scope 🔭

**Kilometer 1**: Organization Calendar (Organizations have no institutional-context parity with Schools yet — no affiliation-status table, no `verifyOrgAccess()`; building Organization Events now would either inherit that gap or require building the missing foundation first), personal (non-institutional) calendar items, recurring events, lunar-date computation, calendar sync/export, notifications, drag/drop, Attendance as a Calendar item, Opportunity deadlines, a Platform Admin General Calendar management UI (managed by direct database/seed access for now), `Event.endsAt`, and any public/private visibility flag on `Event` (every K1 School Event is public by default, matching `NewsPost`/`Opportunity`'s existing precedent).

**Kilometer 1.1**: BS↔AD conversion of any kind (no library installed, no computed/fabricated `bsDateDisplay` — see "General Calendar" above), Grade/Section/Subject filtering on the Admin Calendar (the school-wide merge stays unfiltered; a category-only client-side filter was considered but judged unnecessary for this kilometer), per-school configurable weekly holiday days (Saturday is hardcoded), blended/dual-color Day Status treatment for overlapping statuses, and any Event-detail page (Calendar item links only ever point at real, already-existing pages). See [KNOWN_GAPS.md](KNOWN_GAPS.md).
