# Academic Structure — Subjects & Teacher Academic Assignment (Phase 3A)

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-29, against the current codebase.
> Part of **Phase 3 — School Academic System**. This document covers Phase 3A only. See [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md) for grades/sections/promotion, [ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md) for sessions, and [PRODUCT_RULES.md](PRODUCT_RULES.md) for the underlying design principles.

## Why this exists ✅

Phase 2 and the Section system give a school a structured School → Session → Grade → Section skeleton, but no way to express *what's taught* or *who teaches it*. Phase 3A adds a school-wide Subject catalog, a per-session record of which subjects each grade offers, and a fine-grained Teacher Academic Assignment linking a teacher to a specific (session, grade, section-or-whole-grade, subject) — the foundation later Phase 3 sub-phases (attendance, homework, teaching progress) will build on.

## Schema ✅

Three new models, no changes to any existing model's columns — only new relation-array fields added to `School`, `Teacher`, `AcademicSession`, `SchoolGrade`, and `Section`. Full field lists in [DATABASE.md](DATABASE.md).

- **`Subject`** — a school-wide catalog entry (`"Mathematics"`, `"Science"`). Reusable across every grade and every academic session — a school defines it once, not once per grade. Never hard-deleted, deactivate only (`isActive`), same precedent as `Section`.
- **`GradeSubject`** — which subjects a grade offers, **for one specific academic session**. Unlike `SchoolGrade`/`Section`, this is not reusable config: every session starts with zero rows, and nothing is ever auto-copied from the prior session. A real `DELETE` route exists (unlike `Subject`/`Section`) since nothing permanent references it directly.
- **`TeacherAcademicAssignment`** — a teacher's subject-teaching assignment for one session: `teacherId, academicSessionId, schoolGradeId, sectionId?, subjectId, gradeSubjectId`. `sectionId: null` means grade-wide (every section); a real value means one specific section. `gradeSubjectId` is a direct FK to the matching `GradeSubject` row — the schema itself makes it impossible to assign a teacher to a subject that grade doesn't actually offer this session.

## Subject Catalog ✅

School-Admin-only, gated by `requireSchoolAdmin(schoolId)`:
- `POST /api/schools/[id]/subjects` — bulk create, comma-separated names, deduped, existing-name collisions silently skipped (idempotent). `@@unique([schoolId, name])`.
- `PATCH /api/schools/[id]/subjects/[subjectId]` — rename and/or toggle `isActive`. `409` on a rename collision. **No delete route** — deactivating hides a subject from new grade offerings and new teacher assignments without touching anything that already references it.

**Verified live**: bulk create with an in-request duplicate (deduped, 3 created not 4); re-submitting an existing name (skipped, not an error); a rename collision returned the `409`; deactivate/reactivate both directions confirmed via UI and database.

## Grade Subject Offering ✅ — session-scoped, not carried forward

`POST /api/schools/[id]/grades/[schoolGradeId]/subjects` — bulk-opts a grade into one or more active `Subject`s **for one academic session**, passed explicitly as `academicSessionId`. `DELETE /api/schools/[id]/grades/[schoolGradeId]/subjects/[gradeSubjectId]` — removes one offering; blocked with `409` if a `TeacherAcademicAssignment` already depends on it ("Remove those assignments first"), never a raw FK crash.

**A new session starts with zero `GradeSubject` rows for every grade** — nothing is auto-copied from the prior session, deliberately, so a past session's curriculum stays exactly as it was even after the school later changes its subject list. The School Admin explicitly re-configures each grade's offering every session (same pattern as `TeacherGradeAssignment`, which also never carries forward).

**Verified live**: offering a deactivated subject was silently skipped; re-submitting an already-offered subject was idempotent (skipped, not duplicated); deleting an offering with a dependent teacher assignment returned `409`, then succeeded once the assignment was removed first.

## Teacher Academic Assignment ✅

`POST /api/schools/[id]/teacher-academic-assignments` — bulk-create, one transaction, sequential per-item loop (so each item's checks see rows created earlier in the *same* batch, not just what was already in the database). For each item:
1. Teacher, grade, and (if given) section must be real, approved/active, and belong to this school and grade.
2. The subject must actually be offered at this grade **this session** — resolved via a matching `GradeSubject` row, whose id becomes the assignment's `gradeSubjectId`. No matching offering → silently skipped.
3. **Overlap rule** (app-level, not a DB constraint — SQL unique indexes treat `NULL ≠ NULL`, so a plain `@@unique` cannot catch two grade-wide rows colliding, same class of rule as the one-`ACTIVE`-session-per-school check): the *same* teacher may never hold both a grade-wide and a section-specific row for the same `(teacherId, academicSessionId, schoolGradeId, subjectId)` tuple. Requesting grade-wide is rejected if *any* row already exists for that tuple; requesting section-specific is rejected only if a grade-wide row already exists for it — other sections for the same teacher/subject are unaffected.
4. An exact duplicate (same teacher/session/grade/section/subject) is caught by `@@unique([teacherId, academicSessionId, schoolGradeId, sectionId, subjectId])` and silently skipped.

`DELETE /api/schools/[id]/teacher-academic-assignments/[assignmentId]` — removes one assignment. Not audited (same as `TeacherGradeAssignment`'s own delete route) — current, freely-reassignable operational data, not a historical decision.

**Multiple different teachers may freely overlap** on the same subject/grade/section — no hierarchy, no primary/assistant/substitute concept exists or is planned for Phase 3A.

**Verified live**, in both orderings: grade-wide created first, a section-specific request for the same teacher/subject/grade correctly rejected (and vice versa — section-specific first, then grade-wide correctly rejected); a different section for the same teacher/subject succeeded (not an overlap); a second, different teacher assigned to the exact same subject/grade/section as an existing assignment succeeded (no hierarchy conflict); an exact duplicate rejected via the DB constraint; a subject not offered at that grade this session silently skipped.

## `requireTeacherAssignment()` ✅ — built, no caller yet

New helper in `src/lib/authorize.ts`. Returns the caller's `userId` if they're an approved `Teacher` at `schoolId` holding a `TeacherAcademicAssignment` matching the given `{academicSessionId, schoolGradeId, sectionId?, subjectId?}` scope — a grade-wide assignment (`sectionId: null`) always satisfies a scope naming any specific section, matching how sections work everywhere else in this schema. `sectionId`/`subjectId` are both optional so the same primitive can express a broad "assigned here at all" check or a narrow "assigned to teach *this subject* here" check. Deliberately teacher-only, no School-Admin bypass baked in — a caller wanting "Admin or the assigned Teacher" composes both checks inline, same as `students/[studentId]/skills` already does.

**Not called from any route yet** — this is the Phase 3A foundation for Phase 3B's attendance, homework, teaching-progress, and units/lessons work, built ahead of its first caller per the explicit brief.

**Verified**: since no route calls it yet, its exact query logic was verified directly against real assignment data — six scenarios (matching subject+section, wrong subject, no-section-filter broadening, no-subject-filter broadening, a teacher scoped to the wrong section, a grade-wide row correctly covering two different specific sections) all returned the expected true/false.

## Read-side UI ✅

- **School Admin** — `/dashboard/academics`: Subject Catalog (list, bulk-add, rename, deactivate/reactivate) and, per grade, the session's subject offering (add/remove) and teacher assignments (assign/remove), with a clear inline message when a single-item assignment request is silently rejected by the overlap rule (the bulk-route's `skipped` count is surfaced as a specific message here, since this UI submits one item at a time, not a genuine batch). Linked from the School Admin dashboard hero and the `/dashboard/grades` index page.
- **Teacher** — a new "Your Academic Assignments" section on the Teacher dashboard, read-only, scoped to the current `ACTIVE` session: grade, subject, and section (or "All sections") for each assignment. This closes part of the pre-existing "Teachers have no dashboard visibility into Phase 2 data" gap noted in [KNOWN_GAPS.md](KNOWN_GAPS.md) — visibility only; no teacher-initiated write action exists yet.

## Deliberately out of scope (Phase 3B and later)

Per the explicit Phase 3A brief: student attendance, homework/assignments and completion checking, subject teaching progress, units/lessons tracking, student/parent academic dashboard features, examinations/results, and analytics/reporting are all untouched by this work — to be designed separately once Phase 3A is reviewed and approved. No teaching hierarchy (primary/assistant/substitute teacher) concept exists or is planned.
