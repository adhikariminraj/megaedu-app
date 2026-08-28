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

All verification runs against the real `prisma/dev.db` SQLite file with real Prisma calls — not a mocked/in-memory database. This is deliberate: it's how the SQLite-vs-Postgres transaction-abort issue (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) was actually discovered, not theorized.

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
- No load/concurrency testing beyond the single deliberate two-tab race condition test (the `alreadyActive` session-creation check).
- No testing against PostgreSQL — everything above ran on SQLite; the one known behavioral difference (transaction-abort-on-error) is documented but not empirically verified against a real Postgres instance, since none exists in this project.
- No accessibility, performance, or cross-browser testing.

## Future/planned 🔭

No specific automated testing strategy has been decided or approved. If taken up, natural starting points given the codebase's own architecture: unit tests for the `src/lib` "sole write-path" functions (`issueCourseCertificate`, `recordGradeDecision`, `matchLegacyGradeText`, `carryForwardEligibleStudents`) — already informally proven correct by the manual tests above; integration tests for the `authorize.ts` helpers; end-to-end tests for the manually-verified flows.
