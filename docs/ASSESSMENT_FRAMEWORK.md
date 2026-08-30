# Assessment Framework Foundation (Phase 3D-1)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30, against the current codebase.
> Part of **Phase 3D — Assessment, Examination, Result, and Report Card system**. This document covers Phase 3D-1 only — the configuration foundation (grading scales, marking-scheme templates, and their assignment to a grade/subject). No marks entry, aggregation, GPA calculation, report cards, or promotion logic exists yet; those are reserved for 3D-2 through 3D-5, to be designed and approved separately. See [PRODUCT_RULES.md](PRODUCT_RULES.md) and [DATABASE.md](DATABASE.md) for how this fits the rest of the schema.

## Why this exists ✅

Real report cards from different Nepalese schools use genuinely different marking structures — some weight components as percentages with letter grades (e.g. Research & Presentation 10%, Term Exam 20%), some use raw maximum marks (Periodic Test 5, Annual Exam 80), some split the year into terms, and some use an entirely different structure per subject (e.g. Computer: Theory 50% / Practical 50%). MEGA.EDU must support configurable assessment systems rather than one hard-coded marking structure. Phase 3D-1 builds the configuration layer this requires — nothing else.

## Schema ✅

Six new models, additive only — no existing model's columns changed, only new relation-array fields on `School`, `AcademicSession`, `SchoolGrade`, and `GradeSubject`. Full field lists in [DATABASE.md](DATABASE.md).

- **`AssessmentFramework`** — a reusable, school-wide marking-scheme template ("Grade 4 Standard", "Computer — Theory & Practical"). Not session-scoped.
- **`AssessmentPeriod`** — an optional grouping layer under a framework ("Term I", "Mid-Term", "Annual").
- **`AssessmentComponent`** — one scored/graded/descriptive piece of a framework ("Periodic Test", "Research & Presentation"), belonging directly to a framework or to one of its periods.
- **`GradingScale`** — a reusable, school-wide marks→grade conversion table ("National Scale 2081", "Pass/Fail").
- **`GradingScaleBand`** — one percentage band within a scale ("90-100 = A+, 4.0 GPA, Outstanding").
- **`AssessmentFrameworkAssignment`** — the *only* session-scoped model in this phase: binds a framework to one `(AcademicSession, SchoolGrade)`, optionally narrowed to one `GradeSubject` as a subject-specific override.

## Reusable template vs. session-scoped assignment — the core architectural decision ✅

`AssessmentFramework` and `GradingScale` are defined once per school and reused across any number of sessions and grades — the same relationship `Subject` already has to `GradeSubject`. This was a deliberate departure from scoping the framework itself to a session+grade (which would have forced a school to re-enter its entire marking scheme — several components, weights, and a grading scale — from scratch every single session, a much heavier cost than re-picking a subject from an existing catalog). Only the *assignment* of a framework to a grade/subject is session-scoped, via `AssessmentFrameworkAssignment` — consistent with the exact same "reusable catalog + session-scoped assignment" split already established for `Subject`/`GradeSubject` in Phase 3A.

## Resolution rule — subject override, then grade default ✅

`resolveFrameworkAssignment()` (`src/lib/assessmentFramework.ts`) implements the rule: look up a subject-specific assignment (`gradeSubjectId` set, matching the given subject) first; if none exists, fall back to the grade-default assignment (`gradeSubjectId: null`). This is the same nullable-scope-discriminator idiom already used three times elsewhere in this schema (`TeachingUnit.sectionId`, `StudentEvaluation.gradeSubjectId`, `ParentTeacherMeeting.gradeSubjectId`) — null = general/default, set = specific.

**Verified live**: with Class 9's default assignment set to "Example A — Weighted Grade-Based" and an IT-subject override set to "Computer — Theory & Practical", resolving for Mathematics (no override) correctly fell back to Example A; resolving for IT correctly returned the override; resolving with no subject given at all (grade-only) correctly returned the grade default directly.

## `maxMarks` does double duty as marks and weight — one field, not two ✅

`AssessmentComponent.maxMarks: Float` is the single number a component is worth, interpreted consistently as "how many points, out of whatever the framework's components sum to." A component worth 10% in a weighted-grade system and a component worth 10 raw marks in a marks-based system are the identical shape — only `entryMode` differs. This is a deliberate simplification over treating "weight" and "marks" as two parallel systems needing reconciliation; see [PRODUCT_RULES.md](PRODUCT_RULES.md) for the full reasoning.

`entryMode` (`"MARKS" | "GRADE" | "DESCRIPTIVE"`) controls how a student's result for that component will eventually be recorded (Phase 3D-2, not built yet):
- **`MARKS`** — a raw number, `0 ≤ marksObtained ≤ maxMarks`.
- **`GRADE`** — a label picked from the framework's own `GradingScale`, to be converted via that label's `gradePoint`, weighted by `maxMarks`'s share of the total.
- **`DESCRIPTIVE`** — free text only, excluded from any numeric aggregate.

**Verified live**: created "Example A" with all five real-world components (`Research & Presentation` 10/`GRADE`, `Work Habits & Assignments` 20/`GRADE`, `Regularity & Classroom Participation` 20/`GRADE`, `Class Test / MCQ / Viva` 30/`MARKS`, `Term Examination` 20/`MARKS`) in one request; created "Example B" with five pure-`MARKS` components (5, 5, 5, 5, 80); created "Computer — Theory & Practical" as a two-component `MARKS` framework (50, 50) — all three represent genuinely different real-world marking philosophies through the identical model, with no special-casing required.

## Periods are optional and components may belong directly to a framework ✅

A framework may define zero periods (a flat, single-block structure — Examples A/B/D) or several (Example C: Term I / Term II). `AssessmentComponent.periodId` is nullable: `null` means the component hangs directly off the framework; a real value nests it under that period.

**Verified live**: created "Example C — Term-Based" with two periods (`Term I`, `Term II`) and eight components, three of which — `Periodic Test`, `Notebook`, `Subject Enrichment` — are deliberately *identically named* in both periods. All eight components were created successfully with no collision, since `@@unique([frameworkId, periodId, name])` scopes uniqueness per-period, not per-framework.

## Grading scales cover every system named in the brief through configuration alone ✅

One `GradingScale` + `GradingScaleBand` model, no special-case models per grading philosophy:
- **Percentage/letter/GPA** — bands with `minPercent`/`maxPercent`/`label`/`gradePoint`/`description` all populated. **Verified live**: created "National Scale 2081" with two bands (90-100% = A+/4.0/Outstanding, 80-90% = A/3.6/Excellent) through the actual UI form.
- **A1/A2/B1/B2, Pass/Fail, marks-only, descriptive-only** — all expressible through the same model (different band boundaries/labels, `gradePoint: null` where GPA math doesn't apply, or `AssessmentFramework.gradingScaleId: null` entirely for marks-only/descriptive-only systems). Not separately built or tested in 3D-1 since the model requires no additional code path for any of them — see [PRODUCT_RULES.md](PRODUCT_RULES.md).

## Two NULL≠NULL uniqueness gaps, both pre-checked explicitly ✅

The same recurring SQL behavior already documented for `TeacherAcademicAssignment`, `ClassTeacherAssignment`, and `StudentEvaluation` — a `@@unique` constraint treats `NULL ≠ NULL`, so it cannot by itself block two rows that are both `null` in the same optional column:

- **`AssessmentFrameworkAssignment`** — `@@unique([academicSessionId, schoolGradeId, gradeSubjectId])` reliably blocks a duplicate subject-specific override, but not a second grade-default (`gradeSubjectId: null`) assignment for the same grade/session. Pre-checked via `assignmentCollisionExists()` (`src/lib/assessmentFramework.ts`), called before every create.
- **`AssessmentComponent`** — `@@unique([frameworkId, periodId, name])` reliably blocks a duplicate component within the same real period, but not two identically-named framework-level (`periodId: null`) components. Pre-checked via `componentCollisionExists()`, called both by the component sub-route and, for a multi-component payload submitted in one framework-creation request, by an in-memory pass over that same request before any row is written.

**Verified live**: a second grade-default assignment for the same grade/session was rejected (`409`); a second subject-override for the same grade/subject/session was rejected (`409`); a second `periodId: null` component named "Theory" on an existing framework was rejected (`409`); two identically-named, period-less components submitted together in one framework-creation request were rejected (`400`, before any row was created).

## Authorization — School Admin only ✅

Every write route is gated by `requireSchoolAdmin(schoolId)` alone — no `requireTeacherAssignment` composition, since Phase 3D-1 has no teacher-facing action at all (marks entry, which will need one, starts in 3D-2). This mirrors the exact authorization shape already used for `Subject`/`GradeSubject` — structural academic config is School-Admin-only throughout this codebase; teachers operate within structure, they never define it.

**Verified live**: a logged-in Teacher (Demo Teacher, approved, with a real Class Teacher assignment) received `403 {"error": "Forbidden"}` from all four write routes attempted directly via `fetch()` (create framework, create assignment, create grading scale, patch framework), and direct navigation to `/dashboard/assessment-frameworks` redirected them to `/dashboard` before any page content rendered — the same School-Admin-only page-access pattern already used by `/dashboard/academics`.

## Read-side UI ✅

`/dashboard/assessment-frameworks` — a single School Admin configuration page (`page.tsx` fetches directly via Prisma, no `GET` API routes were built, matching every other Phase 3 admin config page's convention): create/toggle grading scales, create/toggle frameworks with nested periods and components, add periods/components to an existing framework, remove periods/components, and assign a framework to a grade or subject for the active session. Linked from the School Admin dashboard as a new "Assessment Frameworks" card, alongside "Subjects & Teacher Assignments" and "Attendance".

## No integration with `UnitTest`/`UnitTestResult` — deliberately ✅

`UnitTest`/`UnitTestResult` (Phase 3B's chapter/unit quiz mechanism) is untouched by this phase and not superseded by it. The two remain genuinely separate, parallel systems: `UnitTest` is a granular, per-chapter quiz with no weighting or grading-scale concept; `AssessmentFramework` is the higher-level, official report-card-driving marking scheme. No auto-derivation of component marks from `UnitTestResult` rows was built or is planned — none of the four real-world examples this phase was verified against call for it, and attempting it now would be exactly the kind of over-engineering this phase was explicitly asked to avoid.

## Known scope decisions — deliberate, not oversights ⚠️

- **Framework structural edits (components/weights) are unrestricted in this phase.** No marks exist yet to be invalidated by an edit, so this can't cause a real problem today — but it must be revisited once Phase 3D-2 introduces real per-student results, since editing a framework already in use could silently invalidate previously-computed aggregates.
- **No versioning/locking of a framework once it's been assigned.** Same reasoning as above — deferred to 3D-2, not solved prematurely.
- **No `GET` list API routes exist for any of the six new models.** Every read happens through `page.tsx`'s own direct Prisma queries, the same convention already used by every other Phase 3A/3B admin config page — a route would only be needed if something other than this one page ever needed to read this data over HTTP.

## Deliberately out of scope

Per the approved Phase 3D-1 design: marks entry, weighted/GPA aggregation, term/annual result computation, report card generation, and any connection to `GradeHistory`/promotion are all untouched by this work — reserved for Phase 3D-2 through 3D-5, each to be designed and approved separately.
