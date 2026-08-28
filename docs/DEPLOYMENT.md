# Deployment

> Status legend: **✅ Implemented** · **🟡 Designed/approved, not yet implemented** · **⚠️ Known gap/issue** · **🔭 Future/planned**
> Last verified: 2026-08-28, against the current codebase. This document describes only what actually exists — no production infrastructure has been set up, and nothing below should be read as implying otherwise.

## Local development ✅

```bash
npm install
npm run dev      # next dev — starts on http://localhost:3000
```

Other `package.json` scripts: `npm run build` (Next.js production build), `npm run start` (serve a production build), `npm run lint` (ESLint), `npm run db:push` (`prisma db push` — applies schema changes directly, no migration files), `npm run db:seed` (`tsx prisma/seed.ts` — idempotent demo data), `npm run db:studio` (Prisma Studio, a local DB browser).

## Database ✅ (dev) / 🔭 (production)

Development uses SQLite, a single file (`prisma/dev.db`), configured via `DATABASE_URL="file:./dev.db"`. `schema.prisma`'s own header comment and `.env.example` both mark this as dev-only:

> "Local dev default (SQLite file). For production, point this at a Postgres connection string (e.g. from Neon: https://neon.tech) and change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`."

⚠️ This switch has never been made or tested. See the SQLite/Postgres transaction-behavior note in [KNOWN_GAPS.md](KNOWN_GAPS.md) and [PRODUCT_RULES.md](PRODUCT_RULES.md) — some bulk-write routes rely on a SQLite-specific behavior (a caught statement error doesn't poison the rest of a transaction) that does **not** hold on Postgres and would need rework before that switch.

## Environment variables ✅

From `.env.example` — the complete, real list; nothing else is read anywhere in the app:

| Variable | Purpose | Dev default |
|---|---|---|
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` |
| `NEXTAUTH_SECRET` | JWT signing secret for NextAuth | placeholder, **must be replaced** for any real deployment (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Canonical app URL NextAuth uses for callbacks | `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` | Platform Admin account created by `db:seed` | `admin@megaedu.local` |
| `SEED_ADMIN_PASSWORD` | Same | `ChangeMe123!` — **must be changed** before seeding a real environment |

## Production deployment 🔭

**Nothing has been deployed.** No hosting platform, no CI/CD pipeline, no Dockerfile, no `next.config.js` production overrides beyond Next.js defaults exist in this repository. This is genuinely unstarted work, not an oversight in documentation.

## Known deployment requirements (inferred from the codebase, not yet acted on) 🔭

Before any real deployment, based on what the code actually requires:

1. A Postgres database (per the schema comment above), with `schema.prisma`'s `provider` switched and `npx prisma db push` (or a proper migration) run against it.
2. A real `NEXTAUTH_SECRET` and `NEXTAUTH_URL` matching the deployed domain.
3. A real `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` before running the seed script, or skip seeding demo/fixture data entirely in production.
4. Review of the bulk-write transaction pattern noted above before relying on it under Postgres.
5. Whatever the hosting platform requires for a standard Next.js 14 App Router app (Node.js runtime; no edge-specific code is used anywhere in this codebase, so no special edge-runtime configuration is needed).

## PostgreSQL considerations ⚠️

Specifically flagging what's known to need attention, not a general "be careful" note:

- The `grade-placements` and `teacher-assignments` bulk-write routes catch a unique-constraint violation (`P2002`) *inside* an open transaction and continue looping. This works on SQLite (verified directly) but would misbehave on Postgres, where a failed statement aborts the whole transaction until rollback. See [PRODUCT_RULES.md](PRODUCT_RULES.md) for the full explanation and the routes affected.
- No Prisma `enum`s are used anywhere specifically because SQLite doesn't support them — this constraint disappears on Postgres, but there's no plan to introduce enums retroactively; the plain-`String` convention is intended to stay regardless of database.
