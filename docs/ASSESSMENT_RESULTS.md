# Assessment Results, Publishing, and Report Cards (Phase 3D-2/3/4)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-30, against the current codebase.
> Part of **Phase 3D — Assessment, Examination, Result, and Report Card system**. This document covers the remaining Phase 3D work built on top of Phase 3D-1's configuration foundation — marks entry, the draft/publish workflow, the central calculation engine, and the Report Card. See [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md) for the framework/component/grading-scale model this builds on, and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles.

## Why this exists ✅

Phase 3D-1 built the *configuration* for how a school defines its marking scheme; nothing yet recorded an actual student's marks, decided when a Parent/Student may see them, or turned raw component scores into a subject grade, a GPA, or a Report Card. This phase adds exactly that — three new models and one central calculation module — without touching a single field of the 3D-1 schema.

## Schema ✅

Three new models, additive only, plus one new optional field on an existing 3D-1 model. No existing model's columns changed otherwise — only new relation-array fields.

- **`AssessmentComponentResult`** — one student's raw entry against one `AssessmentComponent`. `gradeSubjectId` and `assignmentId` are both stored directly on the row (not re-derived at read time) — see "Freezing at entry time" below.
- **`AssessmentComponentResultAudit`** — append-only correction log, written only once the parent subject's publication is `PUBLISHED`.
- **`AssessmentResultPublication`** — the single place "is this subject's result visible to Parent/Student yet" is decided, keyed by `(gradeSubjectId, studentId)` — subject-level, never per-component.
- **`GradingScaleBand.isPassing: Boolean?`** (new field on the existing 3D-1 model) — optional, never inferred from label text, reserved for a future Promotion-roster reference display.

## Lazy result creation — a deliberate divergence from `UnitTestResult`'s eager pattern ✅

`UnitTestResult` pre-creates a `PENDING` row for every enrolled student the moment a `UnitTest` is created, because a test has one clean, one-shot creation moment. `AssessmentComponent` has no equivalent: it's defined at framework-*design* time, which can be long before any assignment exists, and — because frameworks are mutable, reusable templates (the whole point of 3D-1) — a component can be **added to an already-assigned framework**. Eager pre-creation at assignment time would silently miss any component added afterward.

Instead: the marks-entry page computes a *virtual* roster exactly the way `UnitTest`'s own creation route computes a real one (`GradeHistory`, scoped to the assignment's grade), and left-joins whatever `AssessmentComponentResult` rows already exist — a student with no row yet simply renders as a blank/`PENDING` slot. No row is created just from viewing the page; the write path (`PATCH .../results`) upserts on submit.

**Verified live**: opened the marks-entry page for a subject with zero `AssessmentComponentResult` rows in the database — the enrolled student rendered correctly as a `PENDING` slot for every component; the first save created exactly one row, confirmed via direct database check.

## Component contribution — `maxMarks` unified, `MARKS`/`GRADE`/`DESCRIPTIVE`/`ABSENT` ✅

`computeComponentContribution()` (`src/lib/assessmentResults.ts`) is the one place a raw result becomes a number of points:

- **`MARKS`** — the raw `marksObtained`, directly.
- **`GRADE`** — the matching `GradingScaleBand`'s **percentage midpoint** applied to `maxMarks` — deliberately **not** `gradePoint`, since `gradePoint` is an arbitrary school-chosen number (0-4, 0-8, whatever) with no inherent relationship to "percent of max marks"; using it as a ratio would silently assume every scale is normalized the same way. The percentage midpoint always works, regardless of GPA convention.
- **`DESCRIPTIVE`** — always excluded from every numeric total (numerator and denominator both), on every mode.
- **`ABSENT`** — contributes zero, regardless of `entryMode` (a student can be absent from a graded oral exam or a descriptive project, not just a marks-based test) — the same convention `UnitTestResult` already uses, and it clears `marksObtained`/`gradeLabel`/`remarks` to `null` exactly like `UnitTestResult` does for its own `ABSENT` status.
- **`PENDING`** — `null`, never zero. A genuinely missing result must never be silently counted as a zero, and the group it belongs to is marked `isComplete: false`.

**Verified live**: created a mixed framework (`MARKS` + `GRADE` + `DESCRIPTIVE` components) and entered all four combinations, including one `ABSENT` `MARKS` component — the database confirmed `ABSENT` correctly cleared all three value fields, and the calculated total correctly counted it as zero while still counting its `maxMarks` in the denominator.

## Aggregation — components → (periods) → subject, one function at every level ✅

```
Framework WITHOUT periods:        Framework WITH periods:

AssessmentComponent[]             AssessmentComponent[] (periodId set)
        │                                  │  (aggregateGroup, per period)
        ▼                                  ▼
  Subject Result                    Period Result × N
                                            │  (sum totalObtained/totalMax across periods)
                                            ▼
                                      Subject Result
```

`aggregateGroup()` is called identically for a period's components and, when a framework has no periods, for the framework's components directly — never two separate implementations. "Annual" is not a third computation level; it's simply the subject result for a framework whose periods already span the full session.

**Verified live**: a framework with `Term I`/`Term II` periods, each containing an `ABSENT` and two `MARKS` components — Term I summed to 70/100 (70%, correctly excluding the absent component's value while still counting its `maxMarks`), Term II to 90/100, and the subject total correctly summed to 160/200 (80%) — confirmed against the actual displayed Report Card, not just the API response.

## Grade lookup — boundary-exclusive, never ambiguous ✅

`lookupGrade()` matches a percentage to a `GradingScaleBand` using `minPercent <= p < maxPercent`, so a shared boundary (one band's `maxPercent` touching the next band's `minPercent`, e.g. both at 80) is never ambiguous — the band that **starts** at 80 wins, matching standard grading convention. The single exception is a percentage of exactly 100, which matches whichever band's own `maxPercent` is 100 (there is no "upper" band to hand it to).

*This boundary rule was corrected during verification*: the first implementation used inclusive bounds on both ends (`minPercent <= p <= maxPercent`), which made a score exactly at a shared boundary match two bands simultaneously, silently resolved by array order. Caught live (a score of exactly 80% and exactly 90% both landed on the wrong side of their intended band) and fixed before this phase was considered complete — verified again afterward with both values landing correctly.

## Cross-subject GPA — explicitly unweighted ✅

`computeUnweightedGPA()` averages whichever subjects have a resolvable `gradePoint` — a plain arithmetic mean, no subject-credit or weighting concept anywhere in this schema. A subject using a marks-only or Pass/Fail scale simply doesn't contribute a point; if *no* subject has one, the GPA is `null`, not `0`. Every UI surface showing this number labels it explicitly "Unweighted GPA."

**Verified live**: two published subjects with `gradePoint` 3.6 each produced a displayed GPA of exactly 3.60.

## GPA is never forced where a scale doesn't support it ✅

A marks-only framework (`gradingScaleId: null`) produces a percentage but no grade/point at all. A descriptive-only framework (every component `DESCRIPTIVE`) produces neither a percentage nor a grade — `totalMax: 0`, `percentage: null`, `isComplete: true` (there's nothing non-descriptive left to be pending). Neither case is special-cased in the calculation engine; both fall out naturally from the same `aggregateGroup()`/`lookupGrade()` functions.

**Verified directly against the calculation engine** (bypassing the UI, calling the pure functions with synthetic data): a marks-only case returned `{percentage: 72, grade: null}`; a descriptive-only case returned `{percentage: null, isComplete: true, totalMax: 0, grade: null}`; an all-`PENDING` case returned `{percentage: null, isComplete: false}` — never a guessed or partial number.

## Publishing workflow ✅

```
(no row) → first entry → DRAFT → explicit Publish → PUBLISHED → correction → PUBLISHED + audit
```

- **Who can publish**: `requireSchoolAdmin(id) || requireTeacherAssignment(id, {..., subjectId})` — the identical composition already used for `StudentEvaluation` sharing. **Subject Teachers publish their own subject's results**; School Admin can publish any subject.
- **Structural safeguard, not just a client-side check**: `POST .../subjects/[gradeSubjectId]/publish` computes `isComplete` server-side and silently skips (not errors) any student with a still-`PENDING` non-`DESCRIPTIVE` component — even a caller that skipped the client check cannot publish an incomplete result through this route.
- **Bulk**: one request publishes every eligible student in the roster, or a given subset — matching the `{published, skipped}` bulk-response convention used throughout this app.
- **Corrections to a published result stay published, audited, never reverted to `DRAFT`** — the same "once shared, corrections are audited, not un-shared" precedent as `StudentEvaluation`. This was an explicit, approved design decision, not a default I picked unprompted.

**Verified live**: publishing while one component was still `PENDING` returned `published: 0, skipped: 1` and left the publication `DRAFT`; completing that component and republishing returned `published: 1`; correcting a component result on an already-`PUBLISHED` subject (25→27 marks) returned `audited: true`, produced exactly one `AssessmentComponentResultAudit` row with the correct before/after values, and the publication's `status` remained `PUBLISHED` throughout — confirmed directly in the database.

## Freezing at entry time — why `assignmentId` is stored, not re-derived ✅

`AssessmentComponentResult.assignmentId` is stamped at entry time rather than re-resolved live via `resolveFrameworkAssignment()` on every read. If a School Admin later reassigns a different framework to the same grade/subject, live re-resolution would misattribute already-entered results to a structure they were never entered against — the same "snapshot at the moment it matters" precedent already established for `Certificate`/`GradeHistoryAudit`. The `AssessmentFrameworkAssignment` `DELETE` route (3D-1) now rejects deletion once any result or publication references it, so this frozen pointer can never dangle.

## Authorization ✅

| Actor | Scope | Mechanism |
|---|---|---|
| School Admin | Full access — entry, correction, publish, any subject | `requireSchoolAdmin(schoolId)` |
| Subject Teacher | Entry, correction, publish — only subjects they hold a matching `TeacherAcademicAssignment` for | `requireTeacherAssignment(schoolId, {academicSessionId, schoolGradeId, sectionId: null, subjectId})`, `subjectId` resolved from the result's own `gradeSubjectId` |
| Class Teacher | **No special role.** Every result is entered in the context of one real subject, even when the governing framework is a grade-default — there is no "general, non-subject-specific" assessment component the way `requireClassTeacher` exists for attendance/general evaluations. | Composes as a normal Subject Teacher only, if separately assigned |
| Parent | Published results for their linked child(ren) only | `fetchAssessmentResults(studentId, "PARENT")`, server-derived `studentId` |
| Student | Published results for themselves only | `fetchAssessmentResults(studentId, "STUDENT")` |

No admin-attribution ("on behalf of a named teacher") validation was added — unlike `StudentEvaluation`/`ParentTeacherMeeting`, `AssessmentComponentResult.evaluatedByUserId` is a plain audit-trail pointer (like `UnitTestResult.evaluatedByUserId`), not a durable authorship attribution, so a School Admin entering marks directly just stamps their own `userId`.

**Verified live**: a School Admin succeeded on every action; a Teacher assigned to Mathematics and Science succeeded on those subjects and received `403 {"error": "Forbidden"}` attempting the same actions on IT (a subject they hold no assignment for); a Parent received `403` on every write route attempted directly via `fetch()`.

## Parent and Student Visibility ✅

`fetchAssessmentResults(studentId, audience: "STUDENT" | "PARENT" | "STAFF")` (`src/lib/assessmentResults.ts`) follows `fetchAcademicProgress()`'s exact three-way convention and slots into the same three existing call sites in `dashboard/page.tsx` (Student branch, Parent branch per child, Student Profile page). `"STUDENT"`/`"PARENT"` filter to `AssessmentResultPublication.status === "PUBLISHED"` only; `"STAFF"` applies no filter.

**Unlike `ParentTeacherMeeting`, `"STUDENT"` is a real member of this audience type** — published results are explicitly meant to reach the Student, so this reuses `fetchAcademicProgress`'s precedent, not the PTM one. Rendered via a new "Assessment Results" section added directly to the shared `AcademicProgressPanel.tsx` — the same component "Teacher Evaluations" was added to in Phase 3C, since there's no policy reason (unlike meetings) to keep this out of the Student's shared render path.

**Verified live**: with one subject `PUBLISHED` and one left `DRAFT`, the Student's own dashboard, the Student's own Report Card, and the linked Parent's dashboard all showed only the published subject — the draft subject appeared nowhere in any of the three. The Student Profile page (School Admin, `"STAFF"` audience) showed all three subjects including the draft one, with its publication status visibly labeled.

## Report Card — a live view, never a persisted snapshot ✅

`buildReportCard(studentId, audience)` (`src/lib/assessmentResults.ts`) assembles student/school/session/grade info, `fetchAssessmentResults()`'s subject results and GPA, and — reused directly, not re-queried — `fetchAcademicProgress()`'s attendance and evaluations. Rendered at `/dashboard/report-card/[studentId]`.

**Deliberately not modeled like `Certificate`.** Investigating `certificateView.ts` before designing this showed a certificate is a *permanent, frozen-at-issuance* snapshot (`*Snapshot` fields, never live-looked-up). A Report Card is the opposite in nature: it must reflect corrections made after publication (see above), so freezing one into a stored row at some past moment would directly contradict the audited-correction design. No PDF export, and no persisted `ReportCard` model — both explicitly out of scope, the same deferred state `Certificate`'s own PDF export is already in.

**Access**: the Student themselves, a Parent linked to that student, or staff (School Admin / any approved Teacher at the school — the same Skills-page/Student-Profile precedent, no assignment-level scoping) — resolved to the matching audience before calling `buildReportCard()`, so a Student/Parent viewing their own report card only ever sees published data through the identical filter used everywhere else.

**Verified live** against real integrated data: the Report Card for a student with two published subjects (one flat, one with two periods) and one draft subject correctly showed subject totals, percentages, grades, GPA, and — for the period-based subject — each period's own sub-total, matched exactly against manual calculation; attendance rendered from the existing `Attendance` data with no duplication.

## Data Integrity Protections ✅

Three guards added to **existing 3D-1 routes**, not new routes — this phase genuinely integrates with 3D-1 rather than sitting beside it:

- **Component structural lock**: `PATCH .../components/[componentId]` rejects `maxMarks`/`entryMode` changes once any `AssessmentComponentResult` exists for that component (`409`) — renaming stays free at any time (cosmetic, not structural). `DELETE` on the same component is rejected under the same condition, since its `onDelete: Cascade` would otherwise silently destroy real result history.
- **Assignment deletion block**: `DELETE .../assessment-framework-assignments/[assignmentId]` rejects deletion if any `AssessmentComponentResult` or `AssessmentResultPublication` references it (`409`).
- **Grading-scale lock**: `PATCH .../grading-scales/[gradingScaleId]` rejects a full `bands` replacement once any framework using that scale has a `PUBLISHED` result anywhere (`409`) — a clear, all-or-nothing policy (locked or not) rather than trying to distinguish "cosmetic" from "structural" band edits inside a full-replace architecture. `name`/`isActive` remain editable at any time. A school needing a materially different scale creates a new one and assigns it going forward.

**Verified live**: changing `maxMarks` on a component with results returned `409`; deleting that component returned `409`; renaming it succeeded (`200`); deleting an assignment with results/publications returned `409`; replacing a grading scale's bands after a published result existed using it returned `409`; renaming that same scale succeeded (`200`).

## Relationship with `UnitTest`/`UnitTestResult` — confirmed separate ✅

Reaffirmed with real results now in place: no merge, no auto-derivation of component marks from unit-test scores. `UnitTest` remains the granular, per-chapter quiz mechanism with no weighting/grading-scale concept; `AssessmentComponent` remains the official, Report-Card-driving marking scheme. A teacher manually entering a component's marks that happen to match one of their own unit-test scores is expected and fine; auto-pulling one into the other isn't demonstrated as needed and would couple two systems that currently have none.

## Promotion Compatibility ✅

`recordGradeDecision()` and the entire `GradeHistory`/`GradeHistoryAudit` promotion workflow are completely untouched — no schema change, no new call site. `GradingScaleBand.isPassing` exists specifically so a future Promotion-roster page could display a computed annual result as read-only reference information alongside the existing Promote/Repeat/Transfer/Leave decision — never read by `recordGradeDecision()` itself, and never auto-selecting a decision.

## Known scope decisions — deliberate, not oversights ⚠️

- **No subject-credit/weighting concept.** Cross-subject GPA is unweighted by design in this phase — see above.
- **No `GET` list API routes** for any of the three new models — reads go through `page.tsx`'s own direct Prisma queries, matching every other Phase 3 admin/results page's convention.
- **No PDF export, no persisted Report Card snapshot** — both explicitly out of scope.
- **`isPassing` is never read by promotion logic in this phase** — reserved for a future reference display only.

## Deliberately out of scope

Per the approved design: automatic promotion/pass-fail decisions, subject-credit weighting, PDF report cards, `UnitTest` integration, and any change to `GradeHistory`/`recordGradeDecision()`/the Certificate system — all untouched, reserved for later phases to design and approve separately.
