# Testing

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase.

## Current state: no automated test suite ⚠️

There is no test framework installed — no Jest, Vitest, Playwright, or Cypress in `package.json`, no config file for any of them, and no `*.test.*` or `*.spec.*` files anywhere in the repository (re-confirmed for this documentation pass). `npm run lint` (Next.js/ESLint) and the TypeScript compiler are the only automated checks that exist.

## What verification practice is actually used instead ✅

1. **Typecheck as a gate.** `npx tsc --noEmit -p tsconfig.json` after every non-trivial change.
2. **Live verification against the running dev server, using seeded demo accounts** (see below), including negative cases — e.g. confirming an unrelated user is correctly redirected away from something they shouldn't see, not just that the right person can see it.
3. **Throwaway verification scripts, run once and deleted.** For anything touching real data — checking for existing duplicate rows before a new constraint, timing a bulk route, proving a sweep is idempotent — a one-off script under `prisma/`, run with `npx tsx`, output inspected, then deleted. Nothing like this is left behind in the repository.

## Development database testing ✅

All verification runs against the real development database with real Prisma calls — not a mocked/in-memory database. Until the PostgreSQL move that was the `prisma/dev.db` SQLite file (still the database on `main`); on branch `pg-foundation` it is the local PostgreSQL database `megaedu_dev` (PG-KM8 onward). This is deliberate: it's how the SQLite-vs-Postgres transaction-abort issue (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) was first identified during SQLite testing. The timeline since then: PG-KM2 (commit `60b23b5`) implemented the fix and was verified on SQLite; compatibility test T07 afterwards confirmed on a real PostgreSQL 18 instance that catching a constraint error and continuing inside a transaction fails; the corrected routes were then exercised against PostgreSQL in PG-KM8 and PG-KM9.

## PostgreSQL verification (PG-KM1–PG-KM10, branch `pg-foundation`) ✅

The move to PostgreSQL was verified in ten kilometers with scripts kept **outside the repository**, under `C:\MEGA_DB_Backup\PG-KM1` … `PG-KM10` on the development machine (each folder holds its scripts, run logs, backups and results). Methods that are now reusable:

- **Content fingerprint** — every row of all 83 models, sorted by primary key and hashed per model, then combined. The baseline for the current dataset is `38e3ad866b225f698a3de46a4e5362d96dc0f00a9b86176396847af81f3569ad` (3,085 rows), established on SQLite in PG-KM1 and reproduced on PostgreSQL after the data copy (PG-KM6), after every test cleanup (PG-KM8, PG-KM9), and on a restored backup (PG-KM10).
- **PG-KM7 integrity suite** (`PG-KM7\pgkm7.ps1`, read-only, runs inside a `READ ONLY` transaction) — database encoding/collation, migration history, all 202 foreign keys validated plus an orphan scan, all 149 primary/unique keys checked for duplicates, the two partial unique indexes (PG-F1 uses a copy updated for the third index: 3 migrations, 150 keys), spot checks of certificates, mark sheets and grade history, then `db:verify:demo`, then the fingerprint again.
- **Test writes with exact cleanup** (PG-KM8, PG-KM9) — take a full `pg_dump` backup and a snapshot of every primary key first; afterwards, a dry run lists every row whose key did not exist before (and stops if any original row changed or disappeared), cleanup deletes exactly those rows in one transaction, and the fingerprint must return to the baseline.
- **Concurrency testing** (PG-KM9) — simultaneous HTTP requests fired from one start barrier against the running app, a PostgreSQL connection sampler, and a benchmark of the homework-completion save limit calling the app's own functions.

Results in brief: application checks for six demo roles passed (PG-KM8); 315 HTTP requests, including 303 requests issued in concurrent bursts, with no `5xx`, no deadlocks and no pool timeouts (PG-KM9); backup restore, rebuild from seeds and SQLite↔PostgreSQL switching rehearsed (PG-KM10); the F1 fix verified (PG-F1: fresh backup, rehearsal on a restored copy, HTTP tests T1–T9, exact cleanup). Findings F1–F7 are in [KNOWN_GAPS.md](KNOWN_GAPS.md#postgresql-findings-f1f7).

## Seeded demo accounts (the de facto manual test fixtures) ✅

From `prisma/seed.ts` (idempotent — safe to re-run):

| Role | Email | Password | Notes |
|---|---|---|---|
| Platform Admin | `admin@megaedu.local` | `ChangeMe123!` (or `SEED_ADMIN_*` env vars) | |
| School Admin | `demo.school@megaedu.local` | `DemoSchool123!` | Administers "Sunrise Academy" (verified) |
| Teacher | `demo.teacher@megaedu.local` | `DemoTeacher123!` | Pre-approved at Sunrise Academy |
| Student | `demo.student@megaedu.local` | `DemoStudent123!` | Pre-approved, `gradeLevel: "Grade 9"` |
| Parent | `demo.parent@megaedu.local` | `DemoParent123!` | Linked to the demo student |
| Organization Admin | `demo.org@megaedu.local` | `DemoOrg123!` | Administers "MEGA Academy Labs" (verified), one published course |

Plus a verified demo school, a published demo course, two demo opportunities, five educational approaches, and 13 seeded `GradeReference` rows.

## Phase 2 verification performed ✅

Every one of the six Phase 2 steps was independently verified with real evidence, not just typechecked, before being considered done:

| Step | Verification performed |
|---|---|
| Schema | `prisma validate` clean; explicit checkpoint review before proceeding |
| `recordGradeDecision()` | Isolated first-decision test (0→1 audit rows, correct previous-state capture); invalid-status rejection confirmed pre-write |
| `matchLegacyGradeText()` | 20+ real inputs including the full Roman numeral range I–X with subtractive notation (IV, IX), messy whitespace, and deliberately ambiguous/out-of-range cases confirmed to correctly return `null` |
| Initial School Setup | Full live run with 5 real students (varied `gradeLevel` text); confident/manual split verified exactly; database check confirmed direct-creation (no audit rows) |
| Student Promotion | All four decisions tested live; 100-student bulk batch through the real API route (328ms, 100/100 audited); mixed already-decided/eligible batch correctly reported `{decided: 1, skipped: 1}`; final-grade edge case (no default target) verified |
| New Session rollover | Full 6-student mixed-outcome scenario verified at the database level; both Pending/Unresolved resolution paths proven distinct; idempotency of the carry-forward sweep proven directly (second run: 0 placed, no error, zero duplicates); 120-student real HTTP timing run (365ms); a 3-session chain proving pending-tracking survives an intervening session with zero rows for that student |

Each test used real throwaway fixture data against the actual database and, where relevant, the actual HTTP routes (not just direct function calls) — and every fixture was fully cleaned up afterward, with a final row-count check confirming zero residue.

## Known testing limitations ⚠️

- No automated regression protection — every verification above was manual and one-time; a future change could silently break any of it without a test suite catching it.
- Concurrency testing exists only as the one-off PG-KM9 runs on PostgreSQL (development mode, each race run once — timing-dependent races can pass one run and fail another; see F2 and F6 in [KNOWN_GAPS.md](KNOWN_GAPS.md#postgresql-findings-f1f7)), the PG-F1 verification of the F1 fix, and the earlier SQLite two-tab race test (the `alreadyActive` session-creation check). PG-F1 added a database-level race that makes every transaction finish its read before any of them inserts (a start barrier), which reproduces the PG-KM9 interleaving reliably; its HTTP replay of the PG-KM9 race, by contrast, happened not to overlap in its one run (the result was still exactly one row). No repeatable load-testing harness exists.
- PostgreSQL has been tested in development only (PG-KM1–PG-KM10); the affected routes were fixed in PG-KM2 (verified on SQLite), the transaction-abort-on-error behavior was then confirmed on a real PostgreSQL instance (compatibility test T07), and the fixed routes were exercised against PostgreSQL in PG-KM8/PG-KM9. No staging/production environment exists to test against.
- `db:verify:demo` validates the current dataset's state, not a freshly seeded database — a freshly seeded database passes 16 of 18 checks (2 of 18 fail), while the current dataset passes 18 of 18 (finding F7 — open, documented only, not fixed).
- No accessibility, performance, or cross-browser testing.

## Future/planned 🔭

No specific automated testing strategy has been decided or approved. If taken up, natural starting points given the codebase's own architecture: unit tests for the `src/lib` "sole write-path" functions (`issueCourseCertificate`, `recordGradeDecision`, `matchLegacyGradeText`, `carryForwardEligibleStudents`) — already informally proven correct by the manual tests above; integration tests for the `authorize.ts` helpers; end-to-end tests for the manually-verified flows.
