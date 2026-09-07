# Mark Sheet

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-07 (Mark Sheet Kilometer 1), against the current codebase.
> Built on top of [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md) (the calculation engine this reuses unchanged) and [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) (the progression decision this reuses unchanged). See [CERTIFICATES.md](CERTIFICATES.md) for the separate, unmerged Certificate domain.

## What a Mark Sheet is — and isn't ✅

A Mark Sheet is the **formal, immutable, issued document representing a student's final annual academic result** for one `AcademicSession` — issued once, at session end, by a School Admin. It is **not**:

- **Not the Report Card.** `/dashboard/report-card/[studentId]` (`buildReportCard()`, `assessmentResults.ts`) stays exactly what it always was: a live, always-current, periodic projection of published assessment data, attendance, and evaluations. A Mark Sheet is issued once and never silently changes; the Report Card is never issued and never stops changing.
- **Not a new calculation engine.** No `FinalAnnualResult` model exists or was added. The final annual result is whatever `fetchAssessmentResults()`/`computeSubjectResultFromParts()` (`src/lib/assessmentResults.ts`) already compute as each subject's `subjectTotal` — the whole-session aggregate across every period a framework defines, unchanged by this work. `AssessmentFrameworkAssignment`'s own `@@unique([academicSessionId, schoolGradeId, gradeSubjectId])` constraint is what makes this unambiguous: exactly one framework governs one subject for one session, so `subjectTotal` already *is* the final annual result for that subject, by construction.
- **Not a new promotion decision.** The Promoted/Not-Promoted/Transferred/Left outcome shown on a Mark Sheet is read from the already-existing, already-audited `GradeHistory.status` decision (`recordGradeDecision()`, `src/lib/gradeHistory.ts`, the Promotion Roster at `/dashboard/grades/[schoolGradeId]`) — never re-decided, never auto-calculated. Issuing a Mark Sheet requires that decision to already exist.
- **Not Certificates.** A separate, unmerged domain (`Certificate`/`Instructor`, `src/lib/certificates.ts`). Some shared conventions (snapshot fields, an issued/immutable document shape) are intentionally similar, but no table, route, or model is shared.

## Data model ✅

Two new, additive models — `MarkSheet` (header) + `MarkSheetSubject` (per-subject snapshot rows) — added to `schema.prisma` via `npx prisma db push`, no destructive change.

**`MarkSheet`**: identity is `studentId` (→ `Student.id`, never `User.id`) + `schoolId` + `academicSessionId` + `version`. Every displayed value is a separate `*Snapshot` field frozen at issuance (`schoolNameSnapshot`, `studentNameSnapshot`, `gradeDisplayNameSnapshot`, `sectionNameSnapshot`, `issuerNameSnapshot`, `outcomeGradeDisplayNameSnapshot`) — none are live-looked-up, matching the exact precedent already proven by `Certificate.*NameSnapshot`. `studentMegaIdSnapshot` is nullable and left `null`, never fabricated, when the Student has no linked `User`. `outcomeStatus` uses the same four-way `GRADE_HISTORY_STATUSES` vocabulary as `GradeHistory.status` (`COMPLETED`/`REPEATED`/`TRANSFERRED`/`LEFT`) — never collapsed to a binary Promoted/Not-Promoted, so a transfer or a leave is never misrepresented as "not promoted."

**`MarkSheetSubject`**: one row per subject, entirely immutable, snapshotting `subjectNameSnapshot`, `marksObtained`, `maximumMarks`, `percentage`, `gradeLabel`, `gradePoint` — `gradeSubjectId` is stored as a plain informational scalar, deliberately **not** a Prisma relation, so `GradeSubject`'s own real `DELETE` route (see [ACADEMIC_STRUCTURE.md](ACADEMIC_STRUCTURE.md)) is never blocked by a permanent reference, and a later subject rename can never alter an issued document.

**No `FinalAnnualResult`, `MarkSheetVersion`, `MarkSheetIssuer`, `MarkSheetResultPeriod`, `Examination`, `Signatory`, or `PromotionRule` model** — each was evaluated and rejected as unnecessary for this kilometer; see the design audit trail for the reasoning behind each.

## Versioning and correction ✅

A correction never edits an issued row. It creates a new `MarkSheet` row (`version + 1`, `status: "ISSUED"`, `correctionReason` set) and marks the prior row `status: "SUPERSEDED"` with a forward pointer (`supersededByMarkSheetId`) — both in one transaction. Superseded rows are never deleted and remain permanently viewable (clearly labeled).

**Database-level integrity, not just application checks**: `@@unique([studentId, academicSessionId, version])` makes a duplicate version number for the same student's same session physically impossible to insert — this is also the concurrency backstop for two simultaneous Issue/correction attempts, since the losing transaction's insert throws outright rather than silently creating a competing version. "Only one current (non-`SUPERSEDED`) version" is enforced via an optimistic-lock `updateMany()` (`WHERE id = ... AND status = 'ISSUED'`, checked for `count === 1`) when superseding — SQLite has no partial unique index to enforce this at the schema level, the same limitation this codebase already works around identically for `AcademicSession` and `TeacherSchoolAffiliation`.

**Verified directly** (not just inferred): a duplicate `(studentId, academicSessionId, version)` insert throws a real unique-constraint violation; a stale `updateMany()` against an already-`SUPERSEDED` row affects 0 rows; a duplicate first-`issueMarkSheet()` call against an already-issued slot is rejected with a clear message rather than creating a second `version: 1`row.

## The write path — `src/lib/markSheet.ts` ✅

- **`gatherSnapshot()`** — private, read-only. Resolves the corrected current placement (see below), verifies a progression decision is already recorded (rejects if still `"ENROLLED"`), verifies every subject with a resolvable framework assignment is `PUBLISHED` (using audience `"STAFF"` specifically — the one audience that surfaces unpublished subjects rather than silently omitting them), and returns the exact data to freeze.
- **`checkMarkSheetEligibility()`** — read-only preview for the School Admin UI.
- **`issueMarkSheet()`** — the only path to create Version 1. Rejects if a Mark Sheet already exists for the slot.
- **`correctMarkSheet()`** — the only path to create a corrected version. Requires a non-empty `correctionReason` and an existing `ISSUED` row to supersede.

Both write functions share one transactional core (`writeMarkSheetVersion()`) and return a typed `{ ok: true, markSheet } | { ok: false, reason }` result — an expected business-rule failure (not yet published, no decision recorded, concurrent conflict) is never a thrown exception, always a clear, user-facing message.

## Phase 0 fix — the GradeHistory placement lookup ✅

Before Mark Sheet Issue could safely exist, a pre-existing ambiguity had to be closed. `fetchAssessmentResults()`, `buildReportCard()`, and `fetchAcademicProgress()` each independently ran:

```ts
prisma.gradeHistory.findFirst({ where: { studentId, academicSession: { status: "ACTIVE" } } })
```

— no school scoping, no `GradeHistory.status` filter, no deterministic order. A student whose `GradeHistory` history touches more than one school (a transfer, or any school whose own session happens to still be open) could resolve an **unrelated school's** `ACTIVE` session, non-deterministically. Harmless-looking on a live Report Card; unacceptable the moment a Mark Sheet **freezes** whatever it finds — including, since Promoted/Not-Promoted is read from this same row, potentially the wrong progression outcome.

**Fix**: one new shared function, `resolveCurrentPlacement(studentId, schoolId)` (`src/lib/gradeHistory.ts`), scoped by `schoolId` and filtered to `CURRENT_ROSTER_STATUSES`. `AcademicSession` already enforces at most one `ACTIVE` row per school (app-level), so once `schoolId` is part of the query, "the" `ACTIVE` session for that school is genuinely unique — deterministic by construction. All three call sites (and their five downstream page call sites — `dashboard/page.tsx` Student/Parent branches, `students/[studentId]/page.tsx`, `grades/[schoolGradeId]/page.tsx`, `report-card/[studentId]/page.tsx`) were updated to pass the `schoolId` they already had in scope (a URL-scoped `schoolId`, or the `Student.schoolId` bridge field already trusted for authorization throughout this codebase).

**Verified live**: existing regression suite (`prisma/verify-demo-data.ts`) passes unchanged in substance (only intentional demo-data count updates); Report Card, Student/Parent dashboards, Student Profile, and the Class Overview ranking all re-tested live post-fix with no regression, against real two-school seed data (the exact scenario the bug required).

## Authorization ✅

| Action | Who | Mechanism |
|---|---|---|
| Issue / Correct | School Admin only | `requireSchoolAdmin(schoolId)` |
| View (own) | Student | `student.userId === session.userId` |
| View (child's) | Parent | `ParentStudent.findFirst({ studentId, parent: { userId } })` — never a client-supplied id |
| View (staff) | School Admin / approved Teacher **at the issuing school** | `markSheet.schoolId`, not the student's *current* school — see Institutional continuity below |

No new authorization concept was introduced — every check reuses the exact pattern already proven by `/dashboard/report-card/[studentId]`.

## Institutional continuity ✅

A Mark Sheet's `schoolId` is the **issuing** school, fixed at issuance — never re-derived from the student's current affiliation. **Verified directly**: issued a Mark Sheet, then simulated a transfer (changed `Student.schoolId` to a different school) and a school rename, then re-read the row — every `*Snapshot` field and `schoolId` were unchanged. A staff member at the issuing school can still open a Mark Sheet it issued even after the student has since transferred elsewhere.

## UI ✅

- **`/dashboard/students/[studentId]/mark-sheet`** — School Admin management surface: eligibility preview, Issue, correction history, Correct/reissue. Teacher (read-only) can view the same status.
- **`/dashboard/mark-sheet/[studentId]`** — owner-facing index of every session with a currently-`ISSUED` Mark Sheet.
- **`/dashboard/mark-sheet/[studentId]/[markSheetId]`** — the formal document view (any version, current or superseded), clean document-style layout: school name/logo (live-looked-up, the one deliberate non-snapshot exception, matching Certificate's own precedent), student identity, MEGA ID (only if present), grade/section, subject-wise marks/percentage/grade/grade point (each column rendered only if at least one subject has that value — a marks-only school never shows an empty GPA/grade column), unweighted GPA (only if computed), final result, issue date, issuer, signature line.
- Cross-linked from the Report Card and Student Profile pages, so the Report Card / Mark Sheet distinction is visible wherever a viewer might look for either.

## Deliberately deferred 🔭

- **PDF generation** — not built; the document view is the only surface, matching Certificate's own deferred-PDF precedent. Persistence (this kilometer) and rendering (later) are cleanly separable, since a PDF would render from the same already-frozen snapshot rows.
- **Public verification / QR / document number exposed publicly** — not built. A Mark Sheet carries meaningfully more sensitive per-document data than a Certificate; the privacy design deserves its own deliberate pass.
- **Rank and Division** — not included, by explicit product decision. Rank exists elsewhere only as a non-persisted, display-only Class Overview position; baking an assumption about ranking policy into an immutable, issued document before the underlying concept is properly designed would be far harder to walk back than leaving it off a live view.
- **Formal signatory / Principal role** — `SchoolAdmin` has no `position`/`title` field; the issuer is simply "the School Admin who performed the Issue action" (`issuedByUserId` + `issuerNameSnapshot`), the same shape as `AssessmentResultPublication.publishedByUserId`.
- **Roll number / symbol number / admission number** — no such field exists anywhere in the schema; not fabricated here.
- **Bulk issuance** — a clean per-student Issue action only, by explicit scope decision.
- **Class Teacher issuance authority** — `ClassTeacherAssignment` grants no assessment authority today (confirmed in [ASSESSMENT_RESULTS.md](ASSESSMENT_RESULTS.md)); extending it is a genuine future design decision, not attempted here.

## Known limitations ⚠️

- Mark Sheet Issue targets only the school's currently **`ACTIVE`** academic session — issuing against a closed/past session is not supported in V1 (`resolveCurrentPlacement()`'s own scope).
- `checkMarkSheetEligibility()`/`gatherSnapshot()` re-run the full `fetchAssessmentResults()` calculation live on every Issue/correction/preview — acceptable for a human-paced, per-student admin action, but inherits the same sequential-query performance shape already flagged for the underlying engine at very large scale.
