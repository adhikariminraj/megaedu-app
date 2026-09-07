# Co-Scholastic

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-07 (Co-Scholastic Kilometer 1), against the current codebase.
> See [ASSESSMENT_FRAMEWORK.md](ASSESSMENT_FRAMEWORK.md)/[ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md) for the scholastic engine this is deliberately independent of, and [MARK_SHEET.md](MARK_SHEET.md) for how it's frozen at annual issuance.

## What this is ✅

A second, parallel, non-numeric evaluation axis — Work Education, Art Education, Health & Physical Education, Discipline, and similar areas — structurally independent of the scholastic `AssessmentFramework` chain. Built from a product+architecture audit against four real school report-card samples, which showed the same four areas graded on genuinely different scales (a 3-point A–C scale for one grade, a 5-point A–E scale for another) **within the same school**.

## No calculation engine — grades are entered, never derived ✅

Unlike scholastic marks, co-scholastic grades are ordinal labels with no defined combination rule. Real evidence: one sample shows Term-I and Term-II co-scholastic grades side by side, **never combined**; another shows a single annual grade with no term concept at all. There is no honest way to compute "Term I: A + Term II: B → Annual: ?" — so **the annual/final grade is always independently entered** (`CoScholasticResult.coScholasticPeriodId: null`), never aggregated from period entries. `src/lib/coScholastic.ts` is pure fetch/entry — no arithmetic.

## Data model ✅

- **`CoScholasticArea`** — a school-wide, reusable catalog entry (mirrors `Subject`). Deliberately scale-agnostic.
- **`CoScholasticPeriod`** — whether a grade uses period-scoped evaluation at all, scoped to `(schoolGrade, academicSession)`, independent of any subject's `AssessmentFramework` (co-scholastic cuts across every subject for a grade, not one). Zero rows = annual-only; named rows ("Term I"/"Term II") = per-period.
- **`CoScholasticGradeSetting`** — the grading-scale ownership, resolved at `(school, grade, session)` — one scale governs every area for that grade that session, matching the real evidence exactly (never per-area-within-a-grade). Reuses `GradingScale`/`GradingScaleBand` unchanged; the percentage ranges on a co-scholastic scale's bands are unused metadata (only `label` is read) — the model is reused purely for its label list.
- **`CoScholasticResult`** — one student's grade for one area, for one scope. `coScholasticPeriodId` has exactly one meaning (`null` = annual, a real id = that period), the same discriminator idiom `AssessmentComponent.periodId` already uses. Inherits the same documented SQLite NULL≠NULL gap as `AssessmentComponent`/`AssessmentFrameworkAssignment`/`StudentEvaluation` — closed via an explicit pre-check in `upsertCoScholasticResult()`, not a new problem.

No publication/visibility gate exists (unlike scholastic `AssessmentResultPublication`) — a result is visible as soon as entered, the same simplicity `Attendance` already has. A deliberate V1 scope decision, not an oversight.

## Teacher workflow ✅

`/dashboard/co-scholastic` → `/dashboard/co-scholastic/[schoolGradeId]` — deliberately the smaller, simpler sibling of the scholastic marks-entry page (`AssessmentResultsEntryClient`): no marks, no weights, no publish step, just a grade `<select>` per area per scope. Authorized to School Admin or any Class Teacher assigned to the grade (`ClassTeacherAssignment`, grade-wide or section-specific) — a deliberate choice matching the real-world evidence that co-scholastic is a homeroom/class-wide responsibility, not a per-subject one. Student-list scoping by section is not enforced in this kilometer (any authorized Class Teacher may enter for the whole grade's roster) — a deliberate V1 simplification.

`/dashboard/co-scholastic-config` — School Admin configuration: the area catalog, then per grade+session, which periods (if any) and which `GradingScale` apply. Additive only — never removes an existing `CoScholasticPeriod`, matching this schema's established "never destructively drop structural config once real data may reference it" precedent.

## Report Card integration ✅

`buildReportCard()` now also returns live co-scholastic results (via `fetchCoScholasticForStudent()`) and the live grading scale(s) in use, rendered as new Report Card sections — always read fresh, matching Report Card's own live/correction-reflecting definition.

## Mark Sheet integration ✅

`issueMarkSheet()`/`correctMarkSheet()` freeze the annual (`coScholasticPeriodId: null`) result per area into `MarkSheetCoScholasticResult` snapshot rows, atomically with everything else at Issue. Optional/best-effort — a missing entry for an area never blocks Issue. See [MARK_SHEET.md](MARK_SHEET.md) for the paired grading-band snapshot.

## Deliberately deferred 🔭

A publication/visibility gate; section-scoped roster filtering for Class Teacher entry; any weighting or aggregation across periods; per-area (rather than per-grade) grading scales.
