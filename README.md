# MEGA.EDU — MVP

A working first slice of MEGA.EDU, built from the System Architecture & Design
document: MEGA ID authentication, school registration/verification, a public
school directory with search, public school profile pages, a school admin
dashboard, a platform admin verification queue, and starter pages for
Resources, Organizations and Educational Approaches.

This is intentionally the **MVP scope**, not the full platform — no course
delivery, marketplace, or payments yet. That's by design (see Part 3.5 of the
design document): prove the free school profile is useful first, then layer
on MEGA Academy, the marketplace, and monetization once real schools are
using it.

## Tech stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes in one codebase
- **Prisma** + **SQLite** for local dev (switch one line to Postgres for production)
- **NextAuth** (credentials provider) for MEGA ID — one login, multiple roles
- **Tailwind CSS** for styling, using the mega.edu brand colors

## Before you start

This code was written without being able to run it in the environment it was
built in (no package registry access there), so **treat first run as a debug
pass**, not a guarantee. If `npm run dev` throws an error, paste it back and
I'll fix it — that's expected to take one or two rounds, not because anything
was done carelessly, but because I genuinely couldn't test this end-to-end
before handing it to you.

## 1. Install

You'll need [Node.js 18+](https://nodejs.org) installed on your machine.

```bash
cd megaedu-app
npm install
```

## 2. Set up your environment

```bash
cp .env.example .env
```

Open `.env` and generate a real secret for `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

Paste the output in as the value. Leave `DATABASE_URL` as the default
SQLite path for now — that's fine for local development.

## 3. Create the database and seed demo data

```bash
npx prisma db push
npm run db:seed
```

This creates:
- A **Platform Admin** account (`admin@megaedu.local` / `ChangeMe123!` unless
  you changed `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`)
- The 5 educational approaches (CBE, STEM, Montessori, Project-Based
  Learning, Values Education)
- One demo verified school ("Sunrise Academy") so the directory isn't empty
- A pre-approved **Demo Teacher** (`demo.teacher@megaedu.local` / `DemoTeacher123!`)
- A pre-approved **Demo Student** (`demo.student@megaedu.local` / `DemoStudent123!`)
- A **Demo Parent** (`demo.parent@megaedu.local` / `DemoParent123!`) already
  linked to the Demo Student
- A pre-verified **Demo Organization** (`demo.org@megaedu.local` /
  `DemoOrg123!`) with one published free course at `/courses/intro-to-cbe`
  and one posted scholarship
- One demo competition posted by Sunrise Academy — both visible at
  `/opportunities`

**Change these passwords before deploying anywhere real.**

## Personalized dashboard greeting

Every dashboard (School, Teacher, Student, Parent, Organization) now opens
with a time-of-day greeting ("Good morning, Minraj.") and 2–3 smart
shortcut cards tailored to that role and their actual current data — e.g.
a School Admin sees a card for pending staff/student approvals only when
there are any; a Teacher or Student sees a "Continue" card only if they
have a course in progress. This is a lighter-weight take on the
"personalized homepage with smart tips" concept, without a full AI
chat assistant (that's a separate, much bigger feature to revisit later).
See `src/components/DashboardHero.tsx` — it's a single reusable component
every dashboard feeds its own card list into.

## Opportunities feed

Scholarships, competitions, events, and jobs — posted by verified Schools
or verified Organizations from a shared "Post Opportunity" form on their
dashboards, visible to everyone at `/opportunities` (filterable by type).
This is the part of MEGA.EDU that's meant to feel like a genuine network,
not just an admin tool — see the design discussion in project history for
why this and the identity/approval system are treated as complementary,
not competing, priorities.

## School Staff (not just Teachers)

`/register-teacher` is now "Register as School Staff" — it covers any
school staff role, not only classroom teachers: Librarian, Counselor,
Coach, Administrative Staff, Nurse, or Other, alongside Teacher. Each
person picks their position at registration; the School Admin's "Staff"
tab shows it as a badge next to their name. The underlying data model
(`Teacher`) and role (`TEACHER`) keep their original names to avoid a
disruptive rename, but conceptually this now means "school staff member."

## MEGA Academy (courses)

- **Organizations** register at `/register-organization` (mirrors school
  registration) and need Platform Admin verification at
  `/admin/organizations` before their courses go live.
- A verified organization's admin creates courses from their `/dashboard`,
  then adds Modules and Lessons on the course's management page
  (`/dashboard/courses/[id]/manage`). A course needs at least one lesson
  before it can be published.
- Published courses appear at `/courses`. Only **free** courses (price =
  0) can be enrolled in right now — paid checkout isn't built yet, so
  paid courses show a "coming soon" message instead of a working Enroll
  button.
- Logged-in **Teachers** and **Students** can enroll and work through
  lessons at `/courses/[slug]/learn`. There's no per-lesson progress
  tracking yet — it's a single "Mark Course Complete" action for the MVP.
- Completing a course issues a **Certificate** with a unique verification
  code, publicly checkable at `/verify/[code]` — no login required, so a
  school or employer can confirm a certificate is real just by opening
  the link.

## Registration flows

- **Schools**: `/register-school` — creates a MEGA ID + school in one step.
  Starts unverified; a Platform Admin must verify it at `/admin/schools`
  before it appears publicly.
- **Teachers**: `/register-teacher` — picks their (already-verified) school
  from a search dropdown. Starts unapproved; that school's admin approves
  them from the "Staff" tab on their dashboard.
- **Students**: `/register-student` — same pattern as Teachers, approved
  from the "Students" tab.
- **Parents**: `/register-parent` — links to their child by the child's
  registered email (the child must already have a Student account). This
  link is automatic for the MVP; no separate approval step yet.

A MEGA ID can hold multiple roles at once, though the current UI only ever
creates one role per registration flow — the data model already supports
a person being, say, a Teacher and a Parent with the same account.

## 4. Run it

```bash
npm run dev
```

Visit **http://localhost:3000**. Try:
- Registering a new school at `/register-school`
- Logging in as the platform admin and verifying it at `/admin/schools`
- Browsing the directory at `/schools`
- Editing your school's profile from `/dashboard`

## 5. Look at your data directly (optional but handy)

```bash
npm run db:studio
```

Opens a browser-based table editor for the database — useful for poking
around without writing SQL.

## Deploying for real

When you're ready to put this on the internet:

1. **Database**: create a free Postgres database at [neon.tech](https://neon.tech).
   Copy the connection string.
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "sqlite"
     ...
   }
   ```
   to:
   ```prisma
   datasource db {
     provider = "postgresql"
     ...
   }
   ```
3. **Hosting**: push this project to a GitHub repo, then import it at
   [vercel.com](https://vercel.com). Add your environment variables
   (`DATABASE_URL` from Neon, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` set to your
   real domain) in Vercel's project settings.
4. Vercel will run `npx prisma generate` automatically on build. After the
   first deploy, run `npx prisma db push` once (locally, pointed at your
   production `DATABASE_URL`) to create the tables, then run the seed
   script the same way if you want the admin account and demo data live.
5. Point your domain at Vercel (they walk you through this in the project's
   Domains settings).

## What's next (not built yet)

Roughly in the order the design document recommends:

- Email verification and password reset
- School/organization logo and cover image upload
- Rich text/media for lesson content (currently plain text only)
- Per-lesson progress tracking (currently whole-course "mark complete" only)
- Quizzes/assessments as a real gate before course completion (the design
  calls for this; the MVP skips straight to "mark complete")
- A lightweight course review step before publishing (currently an
  organization can publish directly once verified — no separate
  per-course approval queue, unlike Schools/Teachers/Students)
- Real payment integration (eSewa/Khalti are the common choices in Nepal)
  — needed before paid courses, School Pro subscriptions, or the
  Marketplace can actually charge anyone
- The Marketplace and Events registration flow
- MEGA Search (unified search across schools/courses/resources/organizations)
- A notification engine (the `Notification` table exists; nothing writes to
  it yet)
- Parent-student linking currently trusts the parent's word once they know
  the child's email — worth hardening later (e.g. requiring the student or
  school to confirm the link) before this handles real families at scale

## Project structure

```
prisma/
  schema.prisma       ← the whole data model, one file
  seed.ts              ← demo data script
src/
  app/
    page.tsx                    ← home page
    register-school/            ← school onboarding flow
    login/
    schools/                    ← public directory + profile pages
    dashboard/                  ← school admin dashboard (protected)
    admin/schools/               ← platform admin verification queue
    resources/ organizations/ approaches/
    api/                        ← all backend routes live here
  components/            ← shared header/footer/session provider
  lib/
    prisma.ts            ← database client
    auth.ts               ← MEGA ID (NextAuth) configuration
    authorize.ts           ← ownership/role check helpers used by API routes
  types/next-auth.d.ts    ← TypeScript types for the session/roles
```
# megaedu-app
