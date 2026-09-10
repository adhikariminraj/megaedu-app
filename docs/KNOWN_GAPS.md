# Known Gaps & Issues

> Last verified: 2026-09-10 (K1-K8 reconciliation — public Organization provider profile, Academy participation/visibility, Opportunity edit/delete, Course↔Provider reciprocal links, MEGA Academy navigation label, Organization logo management, obsolete certificate backfill script removal, Organization Events & Resources; plus a MEGA Academy planning-scope reconciliation adding the K10-K17+ development track and Development Gate mapping) — every item below was actively re-checked against the current codebase before being listed (grep/read, not assumption). If an item is ever fixed, move it out of this file rather than leaving it marked open.

## Data model gaps

### `School.isActive` / `Organization.isActive` are read but never written ⚠️
Both fields default to `true` and are used as a filter in two places (`schools/search`, Platform Admin dashboard counts), but **no route anywhere ever sets either to `false`**. There is no deactivation action in the app. Confirmed via a direct search: `isActive` appears in exactly three files, all reads.

## Database portability

### SQLite-specific transaction behavior in two bulk-write routes ⚠️
`POST /api/schools/[id]/grade-placements` and `POST /api/schools/[id]/teacher-assignments` catch a unique-constraint violation inside an open `prisma.$transaction` and continue the loop — this relies on SQLite tolerating a caught statement error without poisoning the rest of the transaction, which is **not** true on Postgres (the documented production target). Measured, not assumed: verified directly that SQLite continues correctly; reasoned (not yet tested against a real Postgres instance, since none exists in this project) that Postgres would abort the transaction after the first collision. Needs rework before any Postgres migration. Full detail: [PRODUCT_RULES.md](PRODUCT_RULES.md), [DEPLOYMENT.md](DEPLOYMENT.md).
**Not affected**: `grade-decisions` and the rollover carry-forward sweep — both validate eligibility *before* opening the transaction and never intentionally hit a duplicate mid-transaction, a genuinely different and Postgres-safe pattern.

## File storage

### School logo / profile photo / Homework Submission uploads assume a persistent local filesystem ⚠️
`src/lib/uploads.ts` writes to `public/uploads/` (School Logos/Avatars) and, as of K3, `private-uploads/` (Homework Submission evidence) on local disk — the simplest architecture for the current deployment model (nothing is deployed anywhere yet), but neither will survive on typical serverless/edge hosting, where the filesystem is ephemeral or read-only. Needs an object-storage adapter (e.g. S3-compatible) before that kind of deployment for both directories; the schema (`logoUrl`/`avatarUrl`/`HomeworkSubmissionAttempt.filePath` as plain strings) doesn't need to change. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Testing

### No automated test suite exists ⚠️
No Jest/Vitest/Playwright/Cypress, no config, no `*.test.*` files anywhere in the repository — confirmed by checking `package.json` and searching the tree. See [TESTING.md](TESTING.md) for what verification practice is used instead (typecheck gate, live browser runs against seeded fixtures, throwaway `tsx` scripts).

## Commerce / payments

### No payment processor is integrated 🔭
`Subscription`/`Payment` are modeled but unconnected. Paid course enrollment (`priceCents > 0`) is explicitly blocked rather than attempted. No "premium," "bundle," or "grade-specific package" concept exists anywhere in the code — confirmed via a direct search returning zero matches. See [PRODUCT_RULES.md](PRODUCT_RULES.md), [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md).

## Certificates

### PDF export and QR code generation are not built 🔭
The certificate visual design is finished and approved as an in-browser preview; downloading a PDF and generating a scannable QR code were both explicitly deferred and never started. A space for the QR code is marked on the certificate layout but rendered empty. See [CERTIFICATES.md](CERTIFICATES.md).

### Grade-certificate issuance doesn't exist 🔭
`Certificate.gradeHistoryId` is a reserved, unlinked column. No `issueGradeCertificate()` function exists, even though `GradeHistory` (its intended data source) is now fully built. This was a deliberate Phase 2 scope exclusion, not an oversight.

### Certificate architecture remains narrowly tied to MEGA Academy course completion 🔭
Reaffirmed as an explicit, retained future milestone (Report Card/Certificate product audit, 2026-09-07) — not touched by the Co-Scholastic/Mark Sheet-snapshot kilometer, since none of that work's real-school evidence bore on Certificates. Still missing: school issuance (`issuerType: SCHOOL`), joint MEGA+school issuance (`JOINT`), achievement/participation/completion credential types beyond course completion, userless institutional-learner issuance (`Certificate.recipientUserId` requires a `User`, unlike Mark Sheet's `Student.id` identity), revocation/status (no field exists), and verification/QR. Explicitly not implemented in this kilometer — named here so it stays on the roadmap rather than disappearing because recent work happened to focus on academic-report documents instead.

### Co-Scholastic has no publication/visibility gate 🔭
Unlike scholastic `AssessmentComponentResult`, a `CoScholasticResult` is visible to Student/Parent as soon as it's entered — the same simplicity `Attendance` already has. A deliberate Kilometer 1 scope decision (the approved architecture never specified a `CoScholasticResultPublication` model), not an oversight. See [CO_SCHOLASTIC.md](CO_SCHOLASTIC.md).

### Co-Scholastic Class Teacher entry is not section-scoped 🔭
Any Class Teacher assigned to a grade (grade-wide or section-specific) may enter Co-Scholastic results for the grade's entire roster in Kilometer 1 — student-list filtering by the teacher's specific section is not enforced. A deliberate V1 simplification, not a security gap (the same authority level already exists for other class-wide actions).

## Phase 2 (Academic Sessions & Grades) — role visibility gaps

### Teachers and Students have no dashboard visibility into Phase 2 grade-placement data 🔭
All of Initial Setup, Promotion, and New Session rollover are School-Admin-only surfaces. A Teacher still can't see their own `TeacherGradeAssignment`s (grade-level, Phase 2) or the roster of a grade they're assigned to — though Phase 3A added read-only visibility into their `TeacherAcademicAssignment`s (subject-level), and Phase 3B added their `ClassTeacherAssignment`s plus attendance/teaching-progress/test-result visibility for the *student* side. A Student still can't see their raw `GradeHistory`/current grade/section directly (only the derived Phase 3B views — attendance, teaching progress, test results). None of this was in Phase 2, 3A, or 3B's scope, but it's worth tracking as the natural next surface.

### Parent visibility into structured `GradeHistory` (current grade/section) is still missing 🔭
The Parent dashboard shows a linked child's Phase 3B academic summary (attendance, teaching progress, test results — added as a standalone fix; see [ACADEMIC_OPERATIONS.md](ACADEMIC_OPERATIONS.md)), but still has no view into the child's structured `GradeHistory` (current grade, section, promotion history) — only the legacy `gradeLevel` free-text field. Not part of Phase 3B's scope; the same gap already existed for the Student's own dashboard before Phase 3B closed it there.

### `Skill` isn't scoped to a teacher's grade assignment 🔭
Any approved teacher at a school can add a `Skill` to any approved student at that school — there's no check against `TeacherGradeAssignment` to restrict this to students in a grade the teacher actually teaches. Pre-dates Phase 2 and wasn't addressed by it.

## Sections — deliberately deferred scope

### No section-level teacher assignment 🔭
Teachers are assigned at the grade level only (`TeacherGradeAssignment`); no `TeacherSectionAssignment` concept exists. Explicitly decided during design, not an oversight — see [PRODUCT_RULES.md](PRODUCT_RULES.md).

### No section-level analytics or reporting 🔭
No per-section counts, dashboards, or breakdowns exist anywhere in the app. Explicitly out of scope for the same reason as above.

## Phase 3A (Subjects & Teacher Academic Assignment)

### A `GradeSubject` offering must be reconfigured from scratch every session 🔭
Deliberate, not a bug (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) — a new session starts with zero subject offerings for every grade, nothing copied from the prior session, so past curricula stay reconstructable. No "copy from last session" convenience action exists, so a school whose curriculum rarely changes must still re-enter it every session. Worth considering as a future opt-in convenience feature that still preserves the underlying session-scoped rows.

## Phase 3B (School Academic Operations)

### A `TeachingUnit`/`TeachingPlan` set must be reconfigured from scratch every session 🔭
Same deliberate non-carry-forward pattern as `GradeSubject` above — a new session starts with zero units/plans, nothing copied from the prior session. No "copy from last session" convenience action exists.

### No teaching hierarchy (primary/assistant/substitute teacher) for either academic or Grade Coordinator/Class Teacher assignments 🔭
Explicitly out of scope, confirmed twice — once for `TeacherAcademicAssignment` in Phase 3A, again for `ClassTeacherAssignment` in Phase 3B ("Do not introduce teacher hierarchy... yet").

### No retest concept for Unit/Chapter Tests 🔭
`UnitTestResult` supports `PENDING`/`EVALUATED`/`ABSENT` only — explicitly deferred, not built.

### Formal term-wide examinations beyond Unit/Chapter Tests, and analytics, are not started 🔭
Explicitly out of scope for Phase 3B. **Since closed**: Teacher Qualitative Evaluation/Parent-Teacher Meetings (Phase 3C-1, see [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md)), Homework (Phase 1, see [HOMEWORK.md](HOMEWORK.md)), and Report Cards (Phase 3D-2/3/4, see [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md)) are all now built — this entry previously listed all three as missing, which is no longer accurate. Still genuinely missing: formal term-wide examinations as their own concept (beyond the existing per-unit Unit/Chapter Tests and the Assessment Framework's own components/periods), and continuous/aggregate cross-subject progress rollups beyond what `assessmentResults.ts` already computes on read.

## Phase 3C (Teacher Qualitative Evaluation & Parent-Teacher Meetings)

### `ParentTeacherMeeting.outcomeNotes` is not audited 🔭
Only `StudentEvaluation.remarks` has the audit-on-share requirement (explicitly specified for this phase); a meeting's outcome notes remain freely editable, current-state data — consistent with `TeacherAcademicAssignment`'s own non-audited precedent, not an oversight.

### No un-share path for a `StudentEvaluation` 🔭
`visibleToParent`/`visibleToStudent` only ever flip `false → true`. Matches the "permanent once released" precedent already established for `Certificate` issuance; revisit only if a genuine correction-after-sharing need arises.

### No parent-initiated Parent-Teacher Meeting requests 🔭
Explicitly deferred for this phase — "Parents are read-only recipients for now. Parent meeting requests can be considered later." See [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Phase 3D-1/2/3/4 (Assessment Framework Foundation, Results, Publishing, Report Cards)

### No `GET` list API routes exist for any Phase 3D model 🔭
Every read happens through the relevant page's own direct Prisma queries (`/dashboard/assessment-frameworks`, `/dashboard/assessment-results`, `/dashboard/report-card/[studentId]`) — the same convention used by every other Phase 3A/3B admin config page. Not a gap in the current feature (nothing else needs to read this data over HTTP yet), but worth noting if a future integration needs one.

### No subject-credit/weighting concept — cross-subject GPA is unweighted by explicit decision 🔭
`computeUnweightedGPA()` treats every subject with a resolvable grade point equally. This was an explicit Phase 3D-2/3/4 decision, not an oversight — "Do not add subject credits or weighting concepts in this phase" — but any future request for a credit-weighted GPA would need a genuinely new field (e.g. a credit/weight on `GradeSubject` or `AssessmentFrameworkAssignment`) that doesn't exist anywhere in this schema today.

### `GradingScaleBand.isPassing` is not read by any Promotion workflow yet 🔭
Added specifically so a future Promotion-roster page could display computed pass/fail as reference information, but `recordGradeDecision()` and every existing Promotion route remain fully unaware of it. No route or UI currently sets or reads it for any decision-making purpose.

### No credit for a component's marks being derived from `UnitTestResult` 🔭
Deliberately not built — see [PRODUCT_RULES.md](PRODUCT_RULES.md) for the reasoning. A teacher whose "Class Test" component happens to match one of their own unit-test scores must re-enter it; no convenience link exists between the two systems.

## Class Overview (Grades & Promotion enhancement)

### "Roll No." on the Class Overview is a display-only position, not a persisted student field 🔭
No roll-number concept exists anywhere in the Prisma schema — confirmed via a direct search across `schema.prisma` returning zero matches. The number shown next to each student on `/dashboard/grades/[schoolGradeId]` is computed purely for display: each student's sequential position within their section's list, in whatever order that section's roster query returns them. It is not stored, not stable against a future reordering of the underlying query, and not something any other page or route can reference. A school that needs a real, persisted, admin-assignable roll number would need a genuinely new schema field — this was not an oversight of the Class Overview work, just outside what it set out to build.

## Phase 4D (Institutional Context) — migration in progress

### Several dashboard areas still resolve school context via the legacy arbitrary-pick pattern ⚠️
Attendance, Evaluations, Meetings, and Grades (Promotion) have been migrated to `getAccessibleSchools()`/`verifySchoolAccess()` (see [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md)). Initial Setup, New Session, Assessment Frameworks, and Assessment Results have **not** been migrated yet — they still resolve "which school" via a plain `schoolAdmin.findFirst({ userId })` (or the equivalent `Teacher` bridge-field read), which silently picks *a* school rather than asking a multi-school Admin/Teacher which one they mean. This is real, in-progress migration debt, not a design decision — each of these areas is a candidate for the same URL-scoped/same-URL/target-derived pattern already proven three times over. Not a security hole (every write route still independently checks `SchoolAdmin`/affiliation ownership of the specific resource being changed) — the gap is which school's data gets *shown*, not unauthorized access to another school's data. **My Profile K1 addressed its own version of this**: `/dashboard/profile` no longer picks one school at all (the old `administeredSchools[0]`/single-school display) — it now reads every `TeacherSchoolAffiliation`/`StudentSchoolAffiliation`/`SchoolAdmin` row directly and shows the complete set, so it never needed the chooser pattern in the first place.

### Organization dashboard has no 2+-organization chooser UX yet 🔭
**Partially resolved** (Organization Institutional Context foundation kilometer): `dashboard/page.tsx`'s `ORGANIZATION_ADMIN` branch no longer uses arbitrary `findFirst()` selection — it now resolves via `getAccessibleOrganizations()` (`src/lib/institutionalContext.ts`), exactly mirroring `getAccessibleSchools()`. For 2+ accessible organizations, the arbitrary silent pick is gone, replaced with an explicit non-interactive boundary page listing every accessible organization by name — but no chooser/switcher UX exists yet (no `OrganizationChooser`, no remembered-preference cookie, no URL-scoped `/dashboard/organizations/[id]` route). That UX is a deliberately separate, not-yet-approved decision. See [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md).

### Student simultaneous multi-school affiliation remains an undecided product policy 🔭
`StudentSchoolAffiliation` permits a Student to hold 2+ `ACTIVE` rows at once — the schema imposes no limit, mirroring the Teacher side — but unlike Teacher (explicitly designed and tested for multi-school), no business rule or product decision has ever been made about whether a Student *should* be allowed to be simultaneously enrolled at two schools. Nothing in the app currently blocks it; nothing in the app was designed assuming it happens. A future phase should either explicitly bless it (and audit every Student-scoped roster/attendance/grade view for multi-school correctness) or add an enforced one-ACTIVE-affiliation-at-a-time rule for Students specifically.

## Homework (Phase 1 / K1 / K2 / K3 / K4 / K5 / K6)

### No School Admin-facing rollup dashboard, notifications, multi-file attachments, or Parent submit-on-behalf 🔭
Deliberate scope decisions, not oversights. K3–K6 completed the full v1 Homework lifecycle (Assign → Applicability → Complete → optional Submission → Review/Feedback → Rollups → Student/Parent Visibility). Still deliberately unbuilt: a School Admin-facing school-wide rollup dashboard (would require date-range/grade filtering to avoid an unbounded query — the Class Teacher/Grade Coordinator rollup at `/dashboard/schools/[schoolId]/homework/progress` is naturally bounded to their own assignment and shipped instead); notifications on submission/review/publish; multi-file/attachment galleries (one text + one file per submission attempt only); Parent submit-on-behalf-of-student (explicitly evaluated and rejected — Parent is view-only throughout, matching the existing Parent-Teacher-Meeting "read-only recipient" precedent); a private-until-shared visibility gate on `HomeworkReview` (immediate visibility was the approved v1 decision); a dedicated full-page Homework History view (the dashboard panel proved sufficient); and any connection to formal assessment/GPA/Report Card/Mark Sheet marks, which remains permanently out of scope per the core product principle that Homework is a learning/feedback workflow, not a graded-assessment one. **No longer a gap**: "this student's completion rate this term" — `computeStudentHomeworkCompletion()`, surfaced via the Student Profile / Parent dashboard Academic Snapshot; see [ASSESSMENT_AND_EVALUATION.md](ASSESSMENT_AND_EVALUATION.md). See [HOMEWORK.md](HOMEWORK.md).

### No reminders or notifications on publish 🔭
Publishing a `Homework` item does not notify anyone (unlike `NewsPost`, which fires `notifySchoolCommunity()`) — a Student/Parent only sees it by visiting their dashboard. Deliberately deferred; the existing `notify()` pattern (`src/lib/notify.ts`) would be the natural mechanism to extend later.

### No upcoming/past homework view 🔭
Only "due today" is surfaced in Phase 1. `fetchTodaysHomework()`'s exact-match `dueDate` query would need to become a range query to support this — a small, additive change, not a redesign, but explicitly out of scope for now.

### School Admin cannot author Homework "on behalf of" a named teacher 🔭
Unlike Evaluations (`teacherHoldsSubjectAssignment()`) or the `TeachingUnit` create route (Admin-or-Teacher composed), Homework creation is Teacher-only — `Homework.teacherId` is a real, non-nullable `Teacher` FK, and Phase 1's approved scope never described an Admin-authoring flow. Worth reconsidering only if a genuine product need for it emerges; would need the same explicit-named-teacher pattern Evaluations already uses.

## Calendar (Kilometer 1 / 1.1 / 1.2)

### General Calendar data only covers September–December 2026 🔭
The seeded reference list (`prisma/seed-general-calendar.ts`) was built from a live research pass that found source-cited, dated holiday data for September through December 2026 only. January–August 2026 were deliberately left out rather than guessed, per an explicit instruction not to invent or guess dates. A follow-up curation pass, checked against the Nepal Panchanga Nirnayak Bikash Samiti's determination and the Ministry of Home Affairs' annual holiday gazette, is needed to complete the year.

### No full Organization Calendar subsystem 🔭
**Partially resolved** (A7 — Organization Events & Resources kilometer). Organization Event *management* now exists: an Organization Admin can create/edit/deactivate their own Events (`POST`/`PATCH /api/organizations/[id]/events`, `requireOrgAdmin`-gated, `isActive: false` deactivation — no `DELETE`, matching School Event's own convention on the same shared `Event` model), and active Organization Events display publicly on `/organizations/[slug]` (capped at 5, ordered by `startsAt`). What remains genuinely unbuilt is the *School-equivalent Calendar experience* — no Annual/Agenda multi-view grid, no `/dashboard/schools/[id]/calendar`-style dedicated page, no inclusion in the public `/calendar` page's projection layer (`src/lib/events.ts` is untouched by this kilometer, by design), and Organization still has no institutional-context history layer (`OrganizationAdmin`/`OrganizationAccountant` remain flat join tables — see [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md)). `getAccessibleOrganizations()`/`verifyOrgAccess()` already exist (Organization Institutional Context kilometer) and are not a blocker for any future Calendar work.

### No Organization Resource management beyond the basic list/create/edit/delete built in A7 🔭
Organization Resources (`POST`/`PATCH`/`DELETE /api/organizations/[id]/resources`, hard delete — Resource has no reverse relations) now exist and display publicly on `/organizations/[slug]` (capped at 5), but there is no file-upload mechanism for `Resource.fileUrl` (it remains a plain, manually-entered string, unlike `School.logoUrl`/`Organization.logoUrl`, which do have real upload infrastructure) and no subject/grade/approach-based filtering on the public `/resources` page for either School- or Organization-owned resources.

### No Event public/private visibility flag 🔭
Every K1-created School Event is public by default, matching `NewsPost`/`Opportunity`'s existing precedent (neither has a privacy flag either). A "keep this internal-only" flag is a small, additive column that can be added later if a school ever asks for it — not built now.

### No recurring events, no interactive Week/Day scheduling grid, no notifications 🔭
The Annual view (Kilometer 1 UI refinement) is a static 12-month display, not an interactive scheduling grid. Recurring events, drag/drop rescheduling, an interactive Week/Day view, and any notification/reminder tied to a Calendar item are all explicitly out of scope — see [CALENDAR.md](CALENDAR.md).

### No BS↔AD calendar experience 🔭
`bsDateDisplay` remains a plain, unpopulated display string on `GeneralCalendarEntry` — no conversion library was installed and no BS date is computed or fabricated anywhere in Kilometer 1.1, per explicit instruction. A genuine dual-calendar experience (a BS year in the page header, every day's BS equivalent) needs either a vetted conversion library or a verified per-day lookup table spanning the display window — a dedicated future kilometer, not attempted here.

### No Grade/Section/Subject or category filtering on the Admin Calendar 🔭
`fetchHomeworkForSchool()`/`fetchMeetingsForSchool()` still return everything school-wide with no filter — at a large, active school this could become a long, undifferentiated list on a busy day. Explicitly deferred per this kilometer's own scope (`Do NOT implement Grade/Section/Subject filtering... DO NOT add category filtering unless truly necessary for the new day-status implementation`) — the Day Status implementation didn't require it, so it wasn't added.

### Weekly holiday is hardcoded to Saturday, no per-school configuration 🔭
`resolveDayStatuses()` computes Weekly Holiday purely from the date's weekday (Saturday) — there is no `School` field for this and no per-school override. Every school on the platform observes Saturday-only today; revisit only if a real school needs a different weekly holiday (e.g. Friday–Saturday).

### Overlapping Day Statuses never blend 🔭
A date resolves to exactly one dominant Day Status via a fixed priority order (`SPECIAL_CLOSURE > EXAMINATION > VACATION > PUBLIC_HOLIDAY > WEEKLY_HOLIDAY`) — e.g. a Saturday that's also a Public Holiday shows only as Public Holiday. No dual-color/split-cell treatment exists; the underlying activity list still shows every real item regardless of which status "won" the background.

## My Profile (Kilometer 1)

### No true `Person` identity layer — MEGA ID remains `User.id` 🔭
The audit behind My Profile K1 confirmed the `Person → Role Identity → Institutional Affiliation → optional User` architecture is a future direction, not current implementation. Today `User` conflates the permanent identity anchor and the optional login account into one row — `MEGA ID = User.id`, unchanged and not reinterpreted by this kilometer. A `Teacher`/`Student` row with a null `userId` (a real, schema-permitted state — see [DATABASE.md](DATABASE.md)) has no MEGA ID at all today, since nothing anchors an identity independent of the login account. Closing this gap means a genuine schema change (a `Person` model MEGA ID could attach to before a login exists) — deliberately not attempted here.

### Organization relationships are not shown in Profile 🔭
`OrganizationAdmin`/`OrganizationAccountant` remain flat join tables with no `status`/date columns and no `verifyOrgAccess()`-equivalent institutional-context layer (unlike School — see [INSTITUTIONAL_CONTEXT.md](INSTITUTIONAL_CONTEXT.md)). My Profile K1 deliberately does not display an Organization relationship rather than presenting a maturity the data model doesn't actually have. Building this requires the same missing Organization institutional-context foundation Calendar K1.1 already deferred for the identical reason.

### No preferences, privacy, or notification settings in Profile 🔭
My Profile K1 is identity/account/security/relationships/addresses only. Notification preferences, privacy controls, and any other account-settings surface remain unbuilt — not attempted, not designed yet.

### No Forgot Password, MFA, or session/device management 🔭
Explicitly out of scope for My Profile K1's Security & Account section — see "Several standard auth features are absent," below, which already covers this platform-wide; Profile's Security section surfaces only what exists (Change Password) and does not imply these are coming in the next kilometer.

### School Admin relationships have no historical concept 🔭
`SchoolAdmin` (see [DATABASE.md](DATABASE.md)) has no `status`/`startDate`/`endDate` columns — a row's existence is the entire relationship. My Profile K1 shows every administered school (never `take: 1`) but cannot show past/ended School Admin relationships, because the schema doesn't record them. Not invented; reported as a real limitation directly in the Profile UI itself.

## Mark Sheet (Kilometer 1)

### V1 targets only the school's currently ACTIVE session 🔭
`resolveCurrentPlacement()`/`gatherSnapshot()` (`src/lib/markSheet.ts`, `src/lib/gradeHistory.ts`) scope Mark Sheet issuance to the school's `ACTIVE` `AcademicSession` only. Issuing a Mark Sheet against a closed/past session (e.g., discovered late, after the school already opened a new session) is not supported — a deliberate V1 scope limit, not an oversight. See [MARK_SHEET.md](MARK_SHEET.md).

### PDF generation, public verification, QR code are not built 🔭
The Mark Sheet document view is in-browser only, the same deferred-PDF state `Certificate` has been in since Phase 1. No document number is exposed publicly, and no `/verify/[code]`-equivalent page exists — a Mark Sheet carries meaningfully more sensitive per-student data than a Certificate, so its public-verification design was deliberately not attempted alongside persistence. See [MARK_SHEET.md](MARK_SHEET.md).

### No Rank or Division 🔭
Deliberately excluded from V1 content, per explicit product decision — no ranking/division policy is configured anywhere in this schema, and baking an assumption into an immutable, issued document before that policy is properly designed would be far harder to walk back than leaving it off. See [MARK_SHEET.md](MARK_SHEET.md).

### No formal signatory / Principal identity 🔭
`SchoolAdmin` has no `position`/`title` field — every School Admin is architecturally identical. A Mark Sheet's issuer is simply "the School Admin who performed the Issue action" (`issuedByUserId` + `issuerNameSnapshot`), not a distinguished Principal/Headmaster role. Building that role system was explicitly out of scope for this kilometer.

### No roll number / symbol number / admission number 🔭
Confirmed absent from the schema entirely (a direct search returns zero matches) — not fabricated on the Mark Sheet. See [MARK_SHEET.md](MARK_SHEET.md) §6/§7 of the design audit trail for the full reasoning.

## Authentication

### Several standard auth features are absent 🔭
No OAuth/SSO, no email verification at registration, no password reset flow, no login/registration rate limiting, no session revocation ("log out everywhere"), no account deactivation or deletion route for any model. See [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md). Add Student/Add Teacher (School Admin direct account creation) route around the missing reset flow specifically by having the admin set and relay a temporary password themselves at creation time — a workaround forced by this gap, not a fix for it; a real reset flow is still absent for every account regardless of how it was created.

### `PLATFORM_ADMIN` can only be granted via the seed script or direct database access 🔭
No in-app route or UI exists to promote a user to Platform Admin, or to revoke it.

## MEGA Academy Development Track — Planned / Awaiting Approval (2026-09-10) 🟡

**Documentation-only planning entry.** Nothing below is implemented, nothing below is authorized for implementation by its presence in this list — this is the tracking record for a proposed future kilometer sequence, added here because this repository has no separate Live Master Development Checklist file (confirmed absent by direct search; see the governing-document note below). These items sit **alongside**, not in place of, the informal A–H/ID structure established earlier in this project's session-based reconciliation audits (e.g. A1–A7, B1–B2, C1–C2.3) — they are a distinct track for a distinct subsystem (the MEGA Academy learning domain proper: curriculum, authoring, learner progress, assessment), not a renumbering or replacement of that structure.

| Kilometer | Scope | Status |
|---|---|---|
| K10 | Audit / Design | ☐ Planned |
| K11 | Learning Schema Foundation | ☐ Planned |
| K12 | Curriculum & Authoring | ☐ Planned |
| K13 | Learner & Progress | ☐ Planned |
| K14 | Assessment | ☐ Planned |
| K15 | Completion & Certificate Integration | ☐ Planned |
| K16 | MEGA Academy Labs Pilot | ☐ Planned |
| K17+ | Future Expansion | ☐ Future |

**None of these are marked completed or approved.** Each is a proposed execution unit only. Each must independently pass the project's Development Gate (below) before any implementation work begins on it — passing K10's own audit does not pre-approve K11, and so on down the list. Two items this track explicitly does **not** cover, because they belong to separately-governed capabilities rather than the Academy learning domain itself: **D3 — Organization-owned Programs** and **D5 — richer certificate capabilities** (QR, PDF, grade-completion variants) — see [COURSES_AND_ENROLLMENTS.md](COURSES_AND_ENROLLMENTS.md)'s reconciliation entry for the full distinction, and [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md) for confirmation that C2.2/C2.3 remain deferred regardless of this track's progress.

### Development Gate — mapped to MEGA Academy

The same 12-area gate this project already applies informally to every kilometer (see the audit-first discipline evident throughout `CHANGELOG.md`), mapped explicitly to any future Academy kilometer so a reviewer has a fixed checklist rather than an ad hoc one:

1. **Ecosystem level** — Does Academy fit inside MEGA.EDU rather than becoming a separate LMS? (It must — MEGA Academy is a shared learning/training platform *within* MEGA.EDU, not a separate institution or product.)
2. **Ownership** — Who owns Programs, Courses, Lessons, Assessments, and learning evidence? (`Organization`, via the existing `Course`→`Organization` relation and whatever new models a learning-domain kilometer introduces — never a duplicate ownership concept.)
3. **Identity** — Does Academy use existing MEGA ID / `User` identity? (Yes, exclusively — no duplicate Learner/Person/AcademyParticipant identity model may be introduced; `CourseEnrollment.userId` is already the precedent.)
4. **Institutional context** — How is provider Organization context resolved without creating duplicate affiliation systems? (Via the existing `getAccessibleOrganizations()`/`verifyOrgAccess()`/`requireOrgAdmin` layer — see [ORGANIZATION_INSTITUTIONAL_CONTEXT.md](ORGANIZATION_INSTITUTIONAL_CONTEXT.md); no parallel resolver.)
5. **Authorization** — Who may create, publish, teach, grade, and administer? (Must be stated explicitly per kilometer, reusing `requireOrgAdmin`/`requireCourseOwner` patterns where the concept genuinely matches, never inventing an ungated path.)
6. **Evidence** — What records prove enrollment, progress, assessment, completion, and certification? (Must be traceable to real rows — reusing `CourseEnrollment`/`Certificate` where possible, extended only with clear justification.)
7. **Security** — Can users access only learning data they are authorized to access? (Every new route needs the same ownership-verification-on-mutation and negative-test discipline every prior kilometer in this project has used.)
8. **Integration** — Does Academy reuse existing Course, Enrollment, Certificate, and Organization systems? (Must be demonstrated, not assumed — see the Program/D3 and Certificate/D5 reuse-vs-new-scope distinctions above.)
9. **Scope** — What is the smallest safe Academy kilometer? (Each of K10–K17+ must be independently scoped this way at its own audit/design gate, not pre-decided by this table.)
10. **Migration / backward compatibility** — Will existing Courses, Enrollments, and Certificates remain intact? (Must be explicitly verified, following this project's nullable-first/additive-only schema-change discipline.)
11. **Verification** — What positive and negative tests are required? (Full authorization matrix, ownership-forgery attempts, regression checks — matching the pattern every K1–K9 kilometer this session used.)
12. **Documentation** — Are architecture, implementation, changelog, and checklist records reconciled? (This entry, and the corresponding entries in `COURSES_AND_ENROLLMENTS.md`/`ORGANIZATION_INSTITUTIONAL_CONTEXT.md`, are the current answer — each future kilometer must update them in turn, the same discipline `CHANGELOG.md` already follows.)

**A note on governing documents**: this reconciliation was requested against a five-document hierarchy (an Original Architecture/Master System Design, a Master Development Plan, a Combined Master & Execution Plan, a Live Master Development Checklist, and an Academy V1 planning document) — a direct, exhaustive search of this repository (filenames and content) found none of the five. This entry, and the corresponding entries in `COURSES_AND_ENROLLMENTS.md` and `ORGANIZATION_INSTITUTIONAL_CONTEXT.md`, are recorded here as the closest existing real governance artifacts in this repository, not as a transcription of those external documents' actual text.
