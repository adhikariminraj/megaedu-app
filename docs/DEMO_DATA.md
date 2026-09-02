# Demo Data

> **Purpose**: a realistic, multi-school demonstration environment so a new person can log into MEGA.EDU and immediately see how the system works — real schools, teachers, students, classes, assessments, results, attendance, and more — without hand-editing the database.
> **Last verified**: 2026-09-01, against the current schema and application code.

---

## What this is

MEGA.EDU already had a minimal bootstrap seed (`prisma/seed.ts`) — one school, one teacher, one student, one parent, one course. That's enough to log in, but not enough to *see the system working*: a single student in a single grade with no assessment results, no attendance, no evaluations.

`prisma/seed-demo.ts` builds a full demonstration environment on top of that bootstrap: two independent schools, a complete academic structure, 60+ students with genuine promotion history, a real multi-subject assessment system with published results, attendance, evaluations, unit tests, parent-teacher meetings, and course completions. Every row is created through direct Prisma writes (the same approach `seed.ts` itself uses) — no application code, API routes, or business rules were changed to build this.

`prisma/verify-demo-data.ts` is a re-runnable check that the environment is internally consistent — see [Verifying the demo data](#verifying-the-demo-data) below.

## Running it

```bash
npm run db:seed         # baseline bootstrap (if not already run)
npm run db:seed:demo    # this demo environment
npm run db:verify:demo  # optional: confirm everything is consistent
```

**Fully reset and rebuild from scratch:**

```bash
npx prisma db push --force-reset
npm run db:seed
npm run db:seed:demo
```

`seed-demo.ts` is **idempotent and self-sufficient** — it re-derives every account, grade, subject, and assignment it needs from `seed.ts`'s bootstrap alone (it does not assume any other data already exists), and every write is either an upsert on the model's own natural unique key or guarded by a deterministic, stable id. Running it against an already-seeded database, or a completely fresh one, produces byte-identical results — verified directly (row counts diffed as identical across repeated runs, in both scenarios).

All demo data is fictional.

---

## Schools created

| School | Location | Role in the demo |
|---|---|---|
| **Sunrise Academy** | Kathmandu | The flagship school — full academic structure, real assessment results, attendance, evaluations, PTMs, course completions |
| **Himalayan Secondary School** | Pokhara | A second, independent, smaller school — demonstrates that each school's data (session, grades, teachers, students) is fully isolated from the other |

Both are `verified: true` and appear in the public school directory.

---

## Login accounts

Every account created by `seed-demo.ts` shares one password: **`MegaDemo123!`**. The 5 original bootstrap accounts (created by `seed.ts`) keep their own existing passwords, unchanged.

### Sunrise Academy — stable, fixed-email accounts

| Role | Email | Notes |
|---|---|---|
| School Admin | `demo.school@megaedu.local` | Bootstrap account (unchanged) |
| Student | `demo.student@megaedu.local` | Bootstrap account — Class 9, Section D; already decided `REPEATED` for *next* session, but shows "Regular" on Class Overview since their own arrival into Class 9 wasn't a repeat (two different, both-correct demonstrations of the same feature) |
| Parent | `demo.parent@megaedu.local` | Bootstrap account, linked to Demo Student |
| Grade Coordinator (Class 9) | `demo.teacher@megaedu.local` | Bootstrap account |
| Class Teacher (9A), Math (9A/9B), Science (9E) | `demo2.teacher@megaedu.local` ("Bimla") | Pre-existing test account, recreated here for self-sufficiency |
| Mathematics (9C/9D), Class Teacher (9C), also teaches Class 6 | `suresh.sharma.math@megaedu.local` |  |
| English (grade-wide, Class 9 & 6) | `anita.gurung.eng@megaedu.local` |  |
| Nepali (grade-wide, Class 9) | `ramesh.thapa.nep@megaedu.local` |  |
| Social Studies (grade-wide, Class 9) | `sita.rai.soc@megaedu.local` |  |
| Science (grade-wide, Class 9) | `prakash.kc.sci@megaedu.local` |  |
| IT/Computer (grade-wide, Class 9) | `bishnu.adhikari.comp@megaedu.local` |  |
| Grade Coordinator (Class 6), Science | `maya.lama.c6@megaedu.local` |  |

### Himalayan Secondary School — stable, fixed-email accounts

| Role | Email | Notes |
|---|---|---|
| School Admin | `admin.himalayan@megaedu.local` |  |
| Grade Coordinator (Class 8), Math & Science | `kiran.basnet.him@megaedu.local` |  |
| English (grade-wide) | `sunita.karki.him@megaedu.local` |  |

### Students and parents (auto-generated)

34 Class 9 students, 12 Class 6 students, and 13 Himalayan Class 8 students, plus 8 parent accounts, are generated with realistic fictional names and predictable emails (`firstname.lastname<n>@megaedu.local`). Names are drawn from a Nepali-context name pool with a **deterministic seeded random generator** — the same script version always produces the same names, marks, and attendance, every time it's run.

The exact current roster (names, emails, section placements) is printed to the console every time you run `npm run db:seed:demo` — that console output is the authoritative, always-current list, rather than a static roster hard-coded into this document that could drift from what a re-seed actually produces.

---

## What's in each module

**Academic structure (Sunrise)** — active session "2026-2027" plus a prior, closed "2025-2026" session (needed for genuine promotion history); Class 9 (sections A–F, four populated) and Class 6 (sections A/B) fully built out; 6 subjects (Mathematics, Science, IT, English, Nepali, Social Studies).

**Students & promotion history** — of the 33 new Class 9 students: 1 has a genuine prior-session `REPEATED` decision into Class 9 (a real `GradeHistoryAudit` trail, not a hard-coded label — shows as "Repeated" on Class Overview), 19 have a real prior-session promotion from Class 8 ("Regular"), and 13 have no prior row at all (genuinely newly enrolled). Class 6 and Himalayan students are simple fresh enrollments.

**Assessment system** — three frameworks sharing one grading scale ("Class 9 Assessment Grade Levels," 6 bands A+ through D, each now with a real `gradePoint`/`isPassing` value): "Mathematics Assessment" and "Science Assessment" as **subject-specific overrides** (each subject needs its own framework instance — see the note below), and "Class 9 Assessment" as the grade default (covering IT/English/Nepali/Social Studies). Each has First Term and Second Term periods with 4 components apiece (Unit Test, Home Work, Port Folio, Written Exam).

**Assessment results** — Mathematics and Science: real, varied marks (per-student ability + noise, not uniform) entered and **published** for all 34 Class 9 students, across both terms — GPA and the Top 5 ranking are computed live by the real `computeUnweightedGPA()`/`computeUnweightedAveragePercentage()` engine, not hard-coded. IT: marks entered for 3 students but deliberately **not published**, demonstrating the draft state.

**Attendance** — 10 school days for Class 9 (A–D), 5 for Class 6 and Himalayan, a realistic present/absent/late/excused mix, including one corrected record with a real `AttendanceAudit` row.

**Evaluations** — 9 total (5 general, 4 subject-specific), spanning private / shared-with-student-only / shared-with-parent-only / shared-with-both, including one post-share correction (`StudentEvaluationAudit`).

**Unit Test** — one Mathematics chapter ("Algebra Basics"), evaluated for Section A (including one `ABSENT`).

**Parent-Teacher Meetings** — one completed (with a linked evaluation), one cancelled, one scheduled — plus the original bootstrap meeting.

**Courses & certificates** — Demo Student's original "Intro to CBE" completion + certificate (recreated for self-sufficiency); a second course, "Hand Writing" (created by this script, since it wasn't part of the bootstrap), completed by one student (a second certificate) and in-progress for another.

**Himalayan Secondary School** — a complete but deliberately smaller/simpler setup: one grade, two sections, ~13 students, light attendance — no assessment framework, evaluations, or PTMs, to keep it a genuinely independent, lower-richness contrast to Sunrise.

### A note on why Mathematics and Science each need their own framework

`AssessmentComponentResult` is uniquely keyed by `(componentId, studentId)` alone — there is no subject dimension in that constraint. If two subjects both resolved to the *same* grade-default framework's *same* component rows, their marks would collide and silently overwrite each other (this was caught live while building this seed data — Science's marks were initially no-op'd onto Mathematics's rows). The fix, and the realistic pattern real schools already use for this per `docs/ASSESSMENT_FRAMEWORK.md`'s own "Computer: Theory 50/Practical 50" example, is a dedicated framework via a subject-specific `AssessmentFrameworkAssignment` override for any subject that needs independently-tracked marks.

---

## Verifying the demo data

```bash
npm run db:verify:demo
```

Checks, against the live database and the **real production calculation functions** (not hand-derived expected values):

- Multi-school isolation (no student or parent visibility crosses Sunrise/Himalayan)
- Class 9 roster counts and section grouping match expectations
- Repeated/Regular/newly-enrolled status is genuinely *derived* from `GradeHistory`, not asserted
- Every student has at least one published subject; marks are realistically varied, not uniform
- IT correctly has entered-but-unpublished results
- Zero orphaned or duplicate rows (`AssessmentComponentResult`, `GradeHistory`)
- No teacher holds both a grade-wide and section-specific assignment for the same subject (the real overlap rule)
- Certificates exist for both completed courses

Exits non-zero if any check fails.

---

## Safety notes

- No application code, API routes, authorization logic, or the Prisma schema were changed to build this — `seed-demo.ts` and `verify-demo-data.ts` are pure data scripts, using direct Prisma Client calls exactly like the existing `seed.ts` already does.
- The only edit to a *pre-existing* row anywhere in this script is filling in previously-`null` `gradePoint`/`isPassing` values on the existing grading scale's bands — no existing value is overwritten.
- Nothing is ever deleted. Re-running `db:seed:demo` is always additive/idempotent.
- No fake school logos or profile photos are seeded — every demo school and person deliberately shows the real initials-based fallback (`src/components/Avatar.tsx`), the same one a real school or user would see before uploading their own. This demonstrates the fallback behavior honestly rather than faking a populated-looking network.
