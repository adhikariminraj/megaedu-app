# Development Guidelines

> Last verified: 2026-08-28. This document is for anyone — human or AI-assisted — making changes to this codebase. It's a set of rules earned from how this project has actually been built across Phase 1 and Phase 2, not generic advice.

## Before touching business logic

**Read [PRODUCT_RULES.md](PRODUCT_RULES.md) first.** Every rule in that file was explicitly discussed and approved, with its rationale preserved. If a change seems to conflict with something documented there, that's a signal to stop and check — not to route around it. Do not change an approved rule unless you've verified the actual implementation proves the rule was never really followed, or a human has explicitly approved changing it.

## Before touching architecture

**Read [ARCHITECTURE.md](ARCHITECTURE.md) first.** This codebase has established, consistent conventions (server components fetch Prisma directly; the "one audited/gatekept write path" pattern for anything transactional; `router.refresh()` as the only revalidation strategy). Introducing a different pattern in one corner of the app — a new state manager, a different mutation flow, a bypass of an existing `lib` helper — makes the codebase harder to reason about even if the new code works. Match what's already there unless there's a real reason not to, and if there is, document it.

## Scope discipline

- **Do not modify unrelated functionality.** A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper someone might use someday. This project has consistently been built in small, explicitly-scoped steps (see the Phase 2 six-step breakdown in [GRADES_AND_PROMOTION.md](GRADES_AND_PROMOTION.md)/[ACADEMIC_SESSIONS.md](ACADEMIC_SESSIONS.md)) — follow that pattern rather than bundling unrelated changes into one pass.
- **Don't add functionality beyond what's asked.** If a request describes 5 steps, build 5 steps — not a 6th "while I'm here" feature. If you notice something that seems missing, flag it rather than silently building it.

## Data integrity

- **Preserve historical records.** `GradeHistory`, `GradeHistoryAudit`, and `Certificate` rows are permanent by design — no route deletes them, and none should be added that does, without an explicit, separate decision to do so. If a student leaves a school, that's a new `status` on their record (`TRANSFERRED`/`LEFT`), never a deleted row.
- **Avoid destructive migrations.** This project's discipline (see [PRODUCT_RULES.md](PRODUCT_RULES.md)) is additive-first: add new fields/models without touching existing ones, verify no data conflicts with a throwaway script before applying anything with a new constraint, and only clean up afterward — sometimes not even then (`Student.gradeLevel` is intentionally permanent).
- **Test migrations before removing old fields.** Before adding a `@@unique` constraint or any other constraint that could reject existing data, write a one-off script that checks the real database for conflicts first. This exact practice caught and prevented a real issue during the `Skill` duplicate-prevention fix.
- **Never use a Prisma `enum`.** Originally because SQLite's connector doesn't support them, even unused ones — this broke a migration before. The project now runs on PostgreSQL, but the plain-`String` convention stays by choice: use a plain `String` field with the valid values documented in a comment above it.

## Schema changes (PostgreSQL)

Decision D5: `prisma migrate` with a reviewed baseline; **`prisma db push` is retired** (the `db:push` script still exists in `package.json` but must not be used). Prisma's schema engine cannot run on the Windows development machine (Smart App Control), so schema-engine work happens only in GitHub Actions (decision D1.a). The sequence for any schema change:

1. Edit `prisma/schema.prisma` on `pg-foundation` (additive-first, as below) and push the branch.
2. The `Prisma migrations (PostgreSQL)` workflow prints the SQL the change needs (and fails if `schema.prisma` has changes no migration covers). Create a new `prisma/migrations/<timestamp>_<name>/migration.sql` from that SQL, **review it** — in particular that it never drops the hand-written partial unique indexes (nine since the F2 fix; listed in [DATABASE.md](DATABASE.md)) — and commit it. A new hand-written partial index also needs its exact `DROP INDEX` line added to the workflow's `ALLOWED_DRIFT`.
3. The workflow then applies every migration with the real `prisma migrate deploy` to a temporary database, checks drift, and saves reference files (download the artifact while signed in to GitHub).
4. Apply locally with `prisma/apply-migrations.ps1` (optionally `-ReferenceRows` pointing at the artifact's `prisma-migrations-rows.csv`, so checksums must match CI), then run `npx prisma generate`.

Rules: every migration containing custom SQL, partial indexes or other constructs Prisma cannot express is reviewed before it is applied; never edit a migration after it has been applied; migration files stay LF-only (`.gitattributes`); never hand-edit `_prisma_migrations`. Transactions use the default isolation level; `SERIALIZABLE` is used only where separately justified (decision D8.8) — currently only the teacher-academic-assignments route, whose overlap rule spans different rows (F2 rule A1) — and a route that uses it must answer a serialization failure cleanly. Recognise a transaction conflict with `isTransactionConflict()` (`src/lib/dbErrors.ts`), never by checking `P2034` alone: Prisma 5.20 reports a serialization failure as `P2034` but leaves a deadlock unmapped (finding F3); every route that writes a batch in one transaction answers it with its `409`. Full detail and the rollback runbook: [DEPLOYMENT.md](DEPLOYMENT.md).

## Don't invent

- **Don't invent data, business rules, or functionality that doesn't exist in the code.** If a request assumes something exists that a search of the codebase doesn't confirm, say so — don't build a plausible-sounding version of it to satisfy the request's framing. (A concrete example from this project's own history: a documentation request assumed "premium courses" and "course bundles" were previously-approved rules; a direct search found zero evidence they were ever built or designed, so the documentation says exactly that instead of inventing a design for them.)
- **Don't invent APIs, database fields, or test results.** Every route, field, and model referenced in `/docs` should be verifiable by reading the actual source — exact names, exact shapes.
- **Don't fabricate historical development information.** This project's git history is a single squashed commit with no granular record — [CHANGELOG.md](CHANGELOG.md) says so explicitly rather than presenting a reconstructed timeline as authoritative fact.

## Verification

- This project has no automated test suite (see [TESTING.md](TESTING.md)) — the substitute is real verification: typecheck (`npx tsc --noEmit`), then exercise the actual change against the running dev server and real database, using throwaway fixture data that gets cleaned up afterward. Don't claim something works because it typechecks; claim it works because you ran it.
- For anything touching a bulk operation or a transaction, verify the transactional behavior directly (does a duplicate get skipped without crashing? does the whole batch commit as one unit?) rather than assuming the code does what it looks like it does.

## Documentation

- **Update documentation when an important architectural or business-rule decision changes** — not as an afterthought, and not by leaving the old doc silently stale. If Phase 3 changes how Promotion works, `GRADES_AND_PROMOTION.md` needs to change in the same pass, the way `ACADEMIC_SESSIONS.md` and `GRADES_AND_PROMOTION.md` were fully rewritten (not just patched) once Phase 2's steps went from designed to actually built and verified.
- Distinguish clearly, always: **✅ Implemented** (exists and works, verified against the running code) vs. **🟡 Designed/approved, not yet implemented** vs. **⚠️ Known gap/issue** vs. **🔭 Future/planned**. Don't blur these to make a feature sound more finished than it is.
- Keep documentation maintainable, not exhaustively verbose — a table beats five paragraphs when the information is the same either way.
