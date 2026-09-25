# Deployment

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-09-26 for the database sections (PostgreSQL foundation PG-KM1–PG-KM10, the F1 fix PG-F1 and the disaster-recovery kilometer PG-DR, branch `pg-foundation`); all other sections as of 2026-09-01. This document describes only what actually exists — no staging or production infrastructure has been set up, and nothing below should be read as implying otherwise.

> **Branch note**: the PostgreSQL foundation described here lives on the `pg-foundation` branch, which is **not yet merged** into `main` (merging is a separate, pending decision). `main` still runs on SQLite.

## Local development ✅

```bash
npm install
npm run dev      # next dev — starts on http://localhost:3000
```

Other `package.json` scripts: `npm run build` (Next.js production build), `npm run start` (serve a production build), `npm run lint` (ESLint), `npm run db:seed` (`tsx prisma/seed.ts` — idempotent bootstrap data), `npm run db:seed:demo` / `npm run db:seed:calendar` (demo environment, see [DEMO_DATA.md](DEMO_DATA.md)), `npm run db:verify:demo` (demo-data consistency check), `npm run db:studio` (Prisma Studio, a local DB browser). `npm run db:push` (`prisma db push`) still exists in `package.json` but is **retired** for this project (decision D5) — do not use it; schema changes go through reviewed migrations (see [Schema changes](#schema-changes-migrations-)). Removing the script itself is a pending, separately approved change.

## Database ✅ (development, PostgreSQL) / 🔭 (staging, production)

Development uses **PostgreSQL 18** (local Windows service, listening on `localhost` only), database **`megaedu_dev`** (UTF-8, `C` collation — chosen so name ordering matches the former SQLite behavior). Prisma 5.20, `provider = "postgresql"`. For the app, the connection string lives in **`.env.local`** (git-ignored), which Next.js loads in addition to `.env` and which overrides `DATABASE_URL` only; `.env` itself is left unchanged. Prisma's CLI and the `tsx` database scripts (`db:seed*`, `db:verify:demo`, `db:studio`) do not read `.env.local` — Prisma loads only the root `.env` — so every rehearsal below supplies `DATABASE_URL` to that process only.

What has been **proven** on PostgreSQL (evidence under `C:\MEGA_DB_Backup\PG-KM1` … `PG-KM10` on the development machine, outside the repository):

| Proven | Kilometer |
|---|---|
| Prisma 5.20 works against PostgreSQL 18.6 (compatibility test in a temporary database: 20 of 21 checks; the remaining one is Prisma rounding a 17-significant-digit float on write, which happens identically on SQLite and affects none of the existing data) | pre-PG-KM3 |
| Schema from the reviewed migrations is identical to the one real `prisma migrate deploy` builds in CI | PG-KM5 |
| All 3,085 SQLite rows copied with identical content (fingerprint `38e3ad866b225f698a3de46a4e5362d96dc0f00a9b86176396847af81f3569ad` reproduced) | PG-KM6 |
| Integrity: 202 validated foreign keys, 0 orphans, 149 primary/unique keys with 0 duplicates, both partial unique indexes present; `db:verify:demo` passes | PG-KM7 |
| The application works against PostgreSQL for the six demo roles tested (school admin ×2, teacher, student, parent, organization admin — platform admin not tested); case-insensitive search preserved; controlled writes behave correctly | PG-KM8 |
| Concurrency: 0 deadlocks, no pool timeouts, the two partial unique indexes turn real races into clean `409`s; completion save limit 5 is safe | PG-KM9 |
| Backup restore, rebuild from migrations + seeds, and local SQLite ↔ PostgreSQL switching | PG-KM10 (see [runbook](#database-rollback--recovery-runbook-)) |

Known findings from this work (F1–F7) are listed in [KNOWN_GAPS.md](KNOWN_GAPS.md#postgresql-findings-f1f7). F1 is fixed on this branch by migration `2_class_teacher_grade_wide_unique` (PG-F1, 2026-09-25); F2–F7 remain open.

## Schema changes (migrations) ✅

`prisma migrate` with a reviewed baseline replaces `db push` (decision D5). Because Windows Smart App Control blocks Prisma's schema engine on the development machine, **schema-engine operations run only in GitHub Actions** (decision D1.a), never locally:

1. **`.github/workflows/prisma-migrations.yml`** runs on pushes to `pg-foundation` that change `prisma/**`, the workflow file itself (`.github/workflows/prisma-migrations.yml`), `package.json` or `package-lock.json`, and can also be started manually (`workflow_dispatch`). On a Linux runner with a temporary PostgreSQL 18 service container — it never connects to a developer machine and uses no secrets — it prints the SQL any schema change still needs, applies all migrations with the real `prisma migrate deploy`, checks for drift against `schema.prisma`, and saves reference files (schema dump, `_prisma_migrations` rows, structure counts) as a downloadable artifact. Artifacts can only be downloaded by a signed-in GitHub user.
2. **Migrations** live in `prisma/migrations/` (`0_init` = the unmodified CI-generated baseline; `1_integrity_partial_indexes` = the two reviewed partial unique indexes; `2_class_teacher_grade_wide_unique` = the reviewed F1 partial unique index, PG-F1). `.gitattributes` keeps them LF-only so their checksums are identical everywhere.
3. **Locally**, `prisma/apply-migrations.ps1` applies pending migrations to the local database with PostgreSQL's own `psql`, each migration and its `_prisma_migrations` history row in **one transaction**, using the same SHA-256 checksum real Prisma records — so the history stays compatible with `prisma migrate deploy`. With `-ReferenceRows <CI prisma-migrations-rows.csv>` it first refuses any checksum that differs from what CI recorded; `-DryRun` changes nothing. It stops on half-finished, unknown or edited migrations.
4. After any schema change, run `npx prisma generate` locally (allowed on Windows; it does not use the blocked schema engine).

**Standing rule (D5)**: every migration containing custom SQL, partial indexes or other constructs Prisma 5.20 cannot express must be reviewed before it is applied. The workflow's drift check tolerates exactly the known partial-index `DROP INDEX` statements — three since PG-F1 — and nothing else (for the first two, Prisma 5.20 has in practice not proposed dropping them; the third is listed the same way, to be confirmed by the next workflow run). A new hand-written partial index needs its exact `DROP INDEX` line added to the workflow's `ALLOWED_DRIFT` in the same change.

Known CI housekeeping item (not acted on): `actions/checkout@v4` and `actions/setup-node@v4` emit a Node.js 20 deprecation warning; upgrading them is a separate, unapproved change.

## Environment variables ✅

From `.env.example` — the complete, real list; nothing else is read anywhere in the app:

| Variable | Purpose | Dev default |
|---|---|---|
| `DATABASE_URL` | Prisma connection string | `.env.example`: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/megaedu_dev?schema=public` (placeholder — the real value goes in the git-ignored `.env.local`; never commit a password) |
| `NEXTAUTH_SECRET` | JWT signing secret for NextAuth | placeholder, **must be replaced** for any real deployment (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Canonical app URL NextAuth uses for callbacks | `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Platform Admin account created by `db:seed` | `admin@megaedu.local` |
| `SEED_ADMIN_PASSWORD` | Same | `ChangeMe123!` — **must be changed** before seeding a real environment |

## File uploads — School Logos & Profile Photos ✅ (dev/traditional server) / ⚠️ (serverless)

School logos and user profile photos (`src/lib/uploads.ts`) are saved to the local filesystem, under `public/uploads/` (gitignored — never committed), and served by Next.js's normal static file handling. `School.logoUrl` and `User.avatarUrl` just store the resulting root-relative URL.

**This storage implementation requires persistent filesystem storage and is appropriate for the current development/traditional server deployment model. Before deployment to typical serverless infrastructure, uploads should be migrated behind an object-storage adapter** (e.g. S3-compatible) — a serverless/edge host's filesystem is typically ephemeral or read-only, so an uploaded file could vanish on the next cold start or fail to write at all. The schema doesn't need to change for that migration (`logoUrl`/`avatarUrl` stay a plain URL string either way) — only `src/lib/uploads.ts`'s save/delete functions would need to swap their implementation.

## Production deployment 🔭

**Nothing has been deployed.** No hosting platform, no deployment pipeline, no Dockerfile, no `next.config.js` production overrides beyond Next.js defaults exist in this repository. The only CI is the database-migrations workflow described above, which validates migrations against a temporary database and deploys nothing. Staging/production hosting — provider, region/data residency, cost, backups and point-in-time recovery, connection pooling, developer access — is an open decision (D3), as is the exact production PostgreSQL major version (15 or newer, decision D6).

## Known deployment requirements (inferred from the codebase, not yet acted on) 🔭

Before any real deployment, based on what the code actually requires:

1. A PostgreSQL database (15 or newer), with the reviewed migrations applied by `prisma migrate deploy` (never `db push`), plus a data plan for that environment.
2. A real `NEXTAUTH_SECRET` and `NEXTAUTH_URL` matching the deployed domain.
3. A real `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` before running the seed script, or skip seeding demo/fixture data entirely in production. Note that `seed.ts` prints the platform-admin password it uses.
4. Connection-pool settings for the target host (`connection_limit`, `pool_timeout`, possibly a pooler) — development ran on Prisma's default pool of 13 connections; production sizing is part of D3.
5. Decisions on the open findings F2–F7 ([KNOWN_GAPS.md](KNOWN_GAPS.md#postgresql-findings-f1f7)); F1 is fixed on this branch (PG-F1).
6. Whatever the hosting platform requires for a standard Next.js 14 App Router app (Node.js runtime; no edge-specific code is used anywhere in this codebase, so no special edge-runtime configuration is needed).

## PostgreSQL considerations ✅ / ⚠️

- ✅ The bulk-write routes that used to catch a unique-constraint violation (`P2002`) *inside* an open transaction and keep looping — which would break on PostgreSQL, where a failed statement aborts the whole transaction — were changed in PG-KM2 to check for duplicates before inserting (commit `60b23b5` on `main`). A duplicate from a truly simultaneous request now rolls the batch back and returns a clean `409`; PG-KM9 confirmed this path under real concurrency on the attendance route (9 of 10 simultaneous identical submissions got `409`, exactly one set of rows was written, no deadlocks — including with the student order reversed).
- ✅ "At most one ACTIVE academic session per school" and "at most one open (ACTIVE/PENDING) affiliation per student" are now enforced by **partial unique indexes** in the database (migration `1_integrity_partial_indexes`), with clean `409` responses; PG-KM9 showed both indexes firing under real races.
- ✅ "At most one grade-wide Class Teacher assignment (Grade Coordinator) per grade per session" is enforced by the partial unique index `ClassTeacherAssignment_one_grade_wide_per_session` (migration `2_class_teacher_grade_wide_unique`, finding F1, PG-F1); a simultaneous losing request gets `409` and its whole batch rolls back.
- ⚠️ The other rules that are still checked only by the application — "empty-slot" rules on grade-wide (`NULL`) rows — are not safe under simultaneous requests on PostgreSQL: see F2.
- No Prisma `enum`s are used anywhere. The original reason was SQLite's lack of support; the plain-`String` convention stays by choice, with no plan to introduce enums retroactively.

## Database rollback & recovery runbook ✅

All procedures below were **rehearsed in PG-KM10** unless marked otherwise (RB6 in PG-DR). Commands that need the PostgreSQL password read it from a hidden prompt (or `PGPASSWORD` set only in that process) — never from a committed file. PostgreSQL tools live in `C:\Program Files\PostgreSQL\18\bin`.

### RB1 — Restore PostgreSQL from a backup ✅ rehearsed
Backups are `pg_dump -Fc` files (e.g. `C:\MEGA_DB_Backup\PG-KM9\megaedu_dev-before-PG-KM9.dump`, SHA-256 `33a9074a…5f81`). Rehearsed by restoring into a **temporary** database, never over the live one:

```powershell
# 1. verify the backup file's SHA-256 matches the recorded value (Get-FileHash)
# 2. create an empty target with the same encoding/collation
psql -h localhost -U postgres -d postgres -c "CREATE DATABASE megaedu_restore_rehearsal ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0"
# 3. restore
pg_restore -h localhost -U postgres -d megaedu_restore_rehearsal --no-owner --exit-on-error <backup.dump>
# 4. verify: content fingerprint, the PG-KM7 integrity suite, db:verify:demo (DATABASE_URL set for that process only)
# 5. drop the temporary database when done
psql -h localhost -U postgres -d postgres -c "DROP DATABASE megaedu_restore_rehearsal WITH (FORCE)"
```

Result: the restored database reproduced fingerprint `38e3ad86…` exactly, passed every PG-KM7 check, and passed `db:verify:demo` with 18 of 18 checks. **Restoring over `megaedu_dev` itself** (e.g. `pg_restore --clean --if-exists --single-transaction -d megaedu_dev <dump>`) was *not* rehearsed and must only be done with explicit approval.

### RB2 — Rebuild PostgreSQL from migrations and seeds ✅ rehearsed (with F7)
1. Create an empty database (UTF-8, `C` collation, `TEMPLATE template0`).
2. Apply the migrations: `powershell -File prisma\apply-migrations.ps1 -Database <name> -ReferenceRows <CI prisma-migrations-rows.csv>` (checksums must match CI).
3. Seed, with `DATABASE_URL` pointing at the new database: `npx tsx prisma/seed.ts`, then `prisma/seed-demo.ts`, then `prisma/seed-general-calendar.ts`. Set `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` explicitly for that process — `seed.ts` prints the admin password.
4. Verify with `npx tsx prisma/verify-demo-data.ts`.

Result: both migrations applied, all three seeds ran successfully on PostgreSQL, and `db:verify:demo` passed **16 of 18 checks** (2 of 18 failed). The two failures are **F7** (open; not a PostgreSQL defect): a fresh `seed-demo.ts` intentionally leaves 2 Class 9 students unassigned, while `verify-demo-data.ts` checks the later state of the current dataset (1 unassigned — see [DEMO_DATA.md](DEMO_DATA.md#verifying-the-demo-data)). The PostgreSQL rebuild itself succeeded. A seeded database has new random IDs, so the PG-KM1 fingerprint does not apply to it. To rebuild with the *current* data instead, use RB1 (restore) or the PG-KM6 method (migrations + copy from the preserved SQLite snapshot, rehearsed in PG-KM6).

### RB3 — Switch the local app between SQLite and PostgreSQL ✅ rehearsed
**Back to SQLite:**
1. Stop the dev server.
2. Park the PostgreSQL connection file: `Rename-Item .env.local .env.local.parked` (contents untouched).
3. `git switch main`, then `npx prisma generate` (the client must report `sqlite`).
4. `npm run dev` — Next.js now loads `.env` only (`DATABASE_URL="file:./dev.db"`).

**Forward to PostgreSQL:**
1. Stop the dev server.
2. `git switch pg-foundation`, then `npx prisma generate` (the client must report `postgresql`).
3. `Rename-Item .env.local.parked .env.local`.
4. `npm run dev` — Next.js loads `.env.local` and `.env`.

Result: the PG-KM10 read-only smoke script (a separate check list, not `db:verify:demo`) passed 19 of its 19 checks in both directions (public pages, certificate verification, search, dashboards for four roles); `db:verify:demo` passed on SQLite with 18 of 18 checks; `dev.db` stayed byte-identical; the PostgreSQL fingerprint stayed `38e3ad86…`. ⚠️ `.gitignore` ignores `.env*.local` but **not** `.env.local.parked`, so while parked the file shows as untracked — never stage it. A parking name matching the ignore pattern (e.g. `.env.parked.local`, which Next.js does not load) would avoid this; that variant was not rehearsed.

### RB4 — Repository rollback (documented, not executed)
While `pg-foundation` is unmerged, rolling back means simply not merging: `main` is unchanged (SQLite). After a future merge, roll back with `git revert -m 1 <merge commit>` (a new commit; history is not rewritten), then regenerate the Prisma client for SQLite and follow RB3.

### RB5 — Reverse copy PostgreSQL → SQLite 🔭 not rehearsed — open decision
Rolling back to SQLite (RB3) uses `dev.db` as it was; anything written only to PostgreSQL after the switch would not be carried back. Whether to accept that loss for development data or to build and rehearse a reverse copy (mirroring the PG-KM6 method into a copy of the SQLite snapshot) is an **open decision**. So is the length of the SQLite rollback window (decision D13): `dev.db` and the PG-KM1/PG-KM6 SQLite backups are preserved until SQLite retirement is separately approved.

### RB6 — Recover on a new computer (disaster recovery) ✅ rehearsed from the external copy (PG-DR)
**Where things are on the development machine**: PostgreSQL's data directory (`C:\Program Files\PostgreSQL\18\data`) and the evidence/backup folder `C:\MEGA_DB_Backup` share one SSD (C:); the repository and `prisma\dev.db` are on a second internal disk (E:). Recovery sets therefore live on a **separate physical disk**, the external USB drive: `H:\MEGA_DB_DR\<date>\`. Each set holds a fresh `pg_dump` of `megaedu_dev`, all of `C:\MEGA_DB_Backup` except `node_modules` (earlier dumps, evidence and the verification tools), a copy of `dev.db`, uncommitted documents, and a **`MANIFEST.json`/`MANIFEST.md`** recording every file's SHA-256, the content fingerprint, the migrations, the PostgreSQL version and the git commit. **Not in the set**: `.env`/`.env.local` (their values are kept in the owner's password manager), `node_modules`, PostgreSQL program files.

1. Install Git, Node.js 24 and **PostgreSQL 18** (EDB installer; a dump made by version 18 needs version 18 or newer to restore). Set `listen_addresses = 'localhost'` in `postgresql.conf` and restart the service (the set contains the old `postgresql.conf`/`pg_hba.conf` for reference).
2. `git clone https://github.com/adhikariminraj/megaedu-app.git`, `git switch pg-foundation`, `npm ci`.
3. Recreate `.env` from `.env.example` and `.env.local` (one `DATABASE_URL` line) using the values from the password manager. A new `NEXTAUTH_SECRET` only signs everyone out.
4. Copy the newest set from the external disk (or from the owner's off-site copy) and check the SHA-256 of at least the dump (`Get-FileHash`) against `MANIFEST.json`.
5. Create the database and restore:
   ```powershell
   psql -h localhost -U postgres -c "CREATE DATABASE megaedu_dev ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0"
   pg_restore -h localhost -U postgres -d megaedu_dev --no-owner --exit-on-error <the dump>
   ```
   The dump already contains the schema, all indexes and the migration history.
6. `powershell -NoProfile -ExecutionPolicy Bypass -File prisma\apply-migrations.ps1 -Database megaedu_dev` — applies only migrations newer than the dump (otherwise it reports 0 pending) — then `npx prisma generate`.
7. Verify: the content fingerprint must equal the manifest's (`MEGA_DB_Backup\PG-DR\pgdr-db.js check-state` in the set also checks migrations, partial indexes and roles), the integrity suite (`MEGA_DB_Backup\PG-F1\pgf1-pgkm7-verify-db.js`), and `db:verify:demo` (18 of 18; `DATABASE_URL` set for that process only — see the README).
8. `npm run dev` and a short smoke check.

**Rehearsed (PG-DR, 2026-09-26)** from set `H:\MEGA_DB_DR\2026-09-26_0010` (305 files, 40 MB, commit `a1fc587`): all files re-verified on H:, the set copied to a local work folder as on a new computer and verified again, the dump restored **directly from H:** into a temporary database — fingerprint `38e3ad86…` (3,085 rows), 3 migrations, the 3 partial unique indexes, integrity suite 19/19, `db:verify:demo` 18 of 18, applier dry run "3 applied, 0 pending"; the temporary database was dropped and `megaedu_dev` was never written. Steps 1–3 and 8 were not rehearsed on a real second computer.

**If no dump survives** but `dev.db` does: the PG-KM6 method (migrations, then copy the SQLite rows) was proven in PG-KM6, but its copy tool needs adapting before it can be reused (fixed source path, expects the 2 migrations of that time, reads SQLite through a Prisma client the `pg-foundation` checkout no longer generates) — deferred decision. `dev.db` also holds only the data from before the PostgreSQL move.

## Development database backup routine ✅ (manual)

- **When**: after every kilometer that changes the schema or the data, and at least weekly — run `C:\MEGA_DB_Backup\PG-DR\pgdr.ps1 backup` (hidden password prompt): read-only pre-flight, fresh `pg_dump`, recovery set with manifest, copy to a **new** dated folder on the external disk, every file re-verified there. From time to time run `pgdr.ps1 rehearsal` to prove the newest set restores.
- **Known limitation**: the tool's pre-flight currently expects the exact post-F1 state (fingerprint `38e3ad86…`, 3 migrations, 3 partial indexes); once a later kilometer changes the data or schema, its expected values must be updated before the next backup, or it stops.
- **Retention**: keep every dated set (about 40 MB each); nothing is deleted automatically.
- **Off-site**: the owner copies the newest set to cloud storage by hand. The dumps contain only fictional demo data, but they include password hashes of demo accounts, so keep that storage private.
- **Secrets** (`.env`, `.env.local`) live in the owner's password manager, never in a set.
- Automatic scheduling (e.g. Windows Task Scheduler) is a separate decision that has not been made.
