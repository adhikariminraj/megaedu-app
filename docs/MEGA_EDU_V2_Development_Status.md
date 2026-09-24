# MEGA.EDU V2 — Development Status

> **Where MEGA.EDU stands today**, area by area. Baseline: repository `120316d` (2026-09-24); written 2026-09-25 from a read-only audit of the code and schema.
> **Legend**: ✅ Implemented · 🟡 Partially implemented · 🟠 Foundation / schema only · 📋 Planned (designed or explicitly deferred) · 🔵 Conceptual / future vision · ⚠️ Known gap
> **The repository is the source of truth.** An item appearing in a plan does not make it built; an item missing from a plan does not make it absent. Technical detail for every row: [MEGA_EDU_V2_Technical_Documentation.md](MEGA_EDU_V2_Technical_Documentation.md). Individually re-verified gaps: [KNOWN_GAPS.md](KNOWN_GAPS.md).

---

## 1. At a glance

| Level | Area | Status |
|---|---|---|
| Core | Identity (MEGA ID) · Authentication · Authorization · School institutional context · Evidence | ✅ |
| Core | Organization institutional context | 🟡 |
| Domain | Schools · Teachers · Students · Parents | ✅ |
| Domain | Organizations | 🟡 |
| Domain | MEGA Academy | 🟡 (core learning loop ✅) |
| Shared service | Educational Approaches | ✅ |
| Shared service | School Website · Resources · Opportunities · Events/Calendar | 🟡 |
| Shared service | Marketplace | 🔵 |
| Platform | Notifications (in-app) | ✅ |
| Platform | Platform Administration | 🟡 |
| Platform | Payments & Subscriptions · Analytics | 🟠 |
| Platform | Trust & Safety | ⚠️ minimal (verification flags only) |
| Vision | Holistic Development · Professional identity · wider ecosystem | 🔵 |

---

## 2. Domain matrix

| Domain | Status | What exists | Main gap | Future direction |
|---|---|---|---|---|
| **Core foundation** | ✅ | `User` = MEGA ID; multi-role `UserRole`; NextAuth credentials/JWT; `require*` guard suite; affiliation lifecycle; `verifySchoolAccess`, `resolveStudentViewAccess`; Academic Snapshot evidence; My Profile | No password reset/email verification/rate limiting/session revocation; no role switcher | Account-security block; context switcher only if architecture supports it |
| **Schools** | ✅ | Registration + verification, profile, logo, official address, approaches, programs/news, opportunities, inquiries, staff/student management, full academic system (Part 3) | No additional School Admin grant; `isActive` never written; four areas on legacy single-school resolution | Foundation-maturity block |
| **Teachers** | ✅ | Affiliations (multi-school), Subject Teacher vs Class Teacher/Grade Coordinator authority, dashboard, Teacher Profile with Current Responsibilities | No teaching hierarchy; no portable professional record | Professional identity (vision) |
| **Students** | ✅ | Single-school affiliation (H2), placement history, DOB + Student ID, dashboard, homework submission, results, calendar | No dashboard link to Report Card/Mark Sheet | Small navigation fix |
| **Parents** | ✅ | Student-confirmed linking, per-child dashboard, Academic Snapshot, homework view, meetings, calendar | Same Report Card/Mark Sheet navigation gap; no parent-initiated meetings | Small navigation fix; parent services (vision) |
| **Organizations** | 🟡 | Entity, registration, verification, Academy participation, logo, profile self-edit, public directory with search, public profile, opportunities/events/resources, accountant grant/revoke | C2.3 multi-org chooser (deferred); no second admin; name/slug editing undecided; `isActive` never written; Accountant has no capability | Organization-maturity block |
| **MEGA Academy** | 🟡 | Courses, module/lesson authoring & reorder, content-integrity rules, publishing, public discovery, free enrollment (any MEGA ID), learning page, completion, certificates, My Courses, provider learner counts | Self-attested completion; paid enrollment blocked; Instructor inert; no assessments/programs | Academy-maturity block |

---

## 3. Capability detail

### Core foundation

| Capability | Status | Notes |
|---|---|---|
| MEGA ID (`User.id`), one identity for many roles | ✅ | Protected |
| Login (email + password), JWT sessions | ✅ | |
| Password change (self-service) | ✅ | Blocked for demo accounts |
| Password reset / email verification / rate limiting / session revocation / MFA / OAuth | ⚠️ not built | |
| Multi-role dashboard + "also linked as" note | ✅ | 📋 no switcher |
| School affiliation lifecycle (JOIN/LEAVE/TRANSFER/REJOIN) | ✅ | Teacher multi-school; Student single-school (H2) |
| School context resolver + chooser + preference cookie | ✅ | ⚠️ Initial Setup, New Session, Assessment Frameworks, Assessment Results still legacy |
| Organization context resolver (`getAccessibleOrganizations`, `verifyOrgAccess`) | 🟡 | `verifyOrgAccess` unused; 📋 C2.3 chooser; 📋 C2.2 history |
| Authorization primitives (`requireSchoolAdmin`, `requireTeacherAssignment`, `requireClassTeacher`, `requireOrgAdmin`, `requireCourseOwner`, `resolveStudentViewAccess`, `resolveApplicabilityAccess`) | ✅ | Protected |
| Assignment-scoped Student Profile | ✅ | Report Card staff view remains school-wide (deliberate precedent) |
| Addresses (Nepal geography), Family & Emergency Contacts | ✅ | |
| Academic Snapshot (Attendance %, Homework Completion %, Overall Performance) | ✅ | Staff profile + Parent dashboard |

### School academic system

| Capability | Status | Notes |
|---|---|---|
| Academic sessions, rollover, pending queue, initial setup wizard | ✅ | |
| Grades, sections, Grade History, audited decisions, Class Overview, promotion | ✅ | |
| Subjects, grade offerings, teacher assignments | ✅ | Nothing carried forward by design |
| Attendance (+ audited corrections) | ✅ | |
| Teaching plans, units/chapters, unit tests | ✅ | |
| Evaluations (general/subject, share-to-parent/student, audit-on-share) | ✅ | 📋 no un-share |
| Parent-Teacher Meetings | ✅ | 📋 no parent-initiated requests, no recurrence |
| Homework v1 (applicability, completion, submission, review, rollups, history) | ✅ | 📋 no marks, notifications, multi-file, School Admin rollup |
| Assessment frameworks, guided wizard, marks entry, subject publishing, audited corrections, unweighted GPA | ✅ | 📋 no weighting |
| Report Card (live) | ✅ | ⚠️ no Student/Parent dashboard link; 📋 no PDF |
| Mark Sheet (issued, versioned, frozen) | ✅ | 📋 no PDF, public verification, rank/division, bulk issue |
| Co-Scholastic evaluation | ✅ | 📋 no publication gate |
| Calendar (General, School Events, School Calendar entries, Day Status, Annual/Agenda) | ✅ | 📋 BS dates, recurrence, reminders, sync |

### Organizations & MEGA Academy

| Capability | Status | Notes |
|---|---|---|
| Organization registration + Platform Admin verification | ✅ | ⚠️ `register-organization` endpoint has no UI caller |
| Organization Admin (first admin) | ✅ | 📋 second-admin grant, admin revoke |
| Organization Accountant | 🟠 | Grant/revoke only; nothing to do until payments |
| Academy participation toggle | ✅ | |
| Organization profile self-edit (description, website) | ✅ | 📋 name/slug |
| Public directory (search, provider filter) + public profile | ✅ | |
| Public owner-eligibility rule (opportunities, resources, approaches) | ✅ | |
| Public link safety (website, apply links) | ✅ | ⚠️ school opportunity write validation |
| Course authoring (modules, lessons, reorder, delete, video links) | ✅ | |
| Publishing + verification/participation enforcement | ✅ | |
| Enrollment (free, any MEGA ID) + learning page | ✅ | |
| Completion + certificate issuance | 🟡 | ⚠️ self-attested |
| My Courses + provider learner counts | ✅ | |
| Paid enrollment | ⚠️ blocked | Needs Payments |
| Lesson-level progress, quizzes/assessment, programs | 🔵 | |
| Instructor model | 🟠 | Informational only; no permissions |

### Certificates

| Capability | Status | Notes |
|---|---|---|
| Course completion certificate (issuer = Organization) | ✅ | |
| Certificate preview + public verification | ✅ | ⚠️ verify page shows recipient MEGA ID (privacy decision open) |
| School / Joint / MEGA.EDU issuer types | 🟠 | Modelled and renderable; never issued |
| Grade-completion certificates | 📋 | Field reserved; no issuance |
| PDF, QR code, revocation | 📋 | |

### Shared services

| Service | Status | What exists | Main gap |
|---|---|---|---|
| **School Website** | 🟡 | Directory (search/filters), school page, notices, contact → inquiries inbox, public events | 🔵 templates, branding, custom domains |
| **Educational Approaches** | ✅ | Platform catalog, school selection, public list/detail with filtered counts | 📋 catalog managed only via seed |
| **Resources** | 🟡 | Organization CRUD, public listing (owner rule), org profile | ⚠️ no search/filter, no school posting, no file upload |
| **Opportunities** | 🟡 | School + Organization CRUD, public listing with type filter, owner rule, safe links | ⚠️ school write validation; 🔵 applications/registration |
| **Events / Calendar** | 🟡 | School calendar system ✅; organization events on profile | 📋 organization calendar, BS dates, recurrence |
| **Marketplace** | 🔵 | Nothing | Depends on Payments |

### Platform services

| Service | Status | What exists | Main gap |
|---|---|---|---|
| **Notifications** | ✅ in-app | `notify()` from approvals, verification, certificates, parent links, school news; bell + list | 🔵 email/SMS/push, preferences |
| **Platform Administration** | 🟡 | Command Center counts, school/org verification queues, any-certificate view | ⚠️ no user management; admin role only via seed |
| **Payments & Subscriptions** | 🟠 | `Subscription`/`Payment` models (unused, school-subscription-shaped); `Course.priceCents` | No processor, entitlements, or revenue model |
| **Analytics** | 🟠 | Platform Admin aggregate counts; homework rollups; Academic Snapshot | 🔵 institution/ecosystem analytics |
| **Trust & Safety** | ⚠️ minimal | `verified` flags; server-side authorization; link safety | No moderation, suspension, deactivation action, admin audit log |

### Vision

| Area | Status | Note |
|---|---|---|
| **Holistic Development** | 🔵 | Strategic direction only; no schema or UI |
| **Professional identity** (portable teacher record) | 🔵 | Affiliation history is the only current seed |
| **Wider ecosystem** (national events, competitions, careers, parent learning) | 🔵 | |

### Engineering & operations

| Item | Status |
|---|---|
| Automated test suite | ⚠️ none (manual verification discipline) |
| Production deployment | ⚠️ none |
| PostgreSQL readiness | ⚠️ untested; two SQLite-specific bulk routes |
| File storage | ⚠️ local filesystem only |
| Documentation | ✅ extensive; see Technical Documentation Appendix B for stale older docs |

---

## 4. What this means for planning

- **Do not rebuild**: anything marked ✅ — extend it.
- **Complete, don't restart**: 🟡 areas already have working foundations.
- **Design before building**: 🟠 and 📋 areas need an explicit design decision first (e.g. C2.3, completion evidence, payments shape).
- **Vision stays vision**: 🔵 areas need product definition before any architecture.

The sequencing of these into future 10-km blocks is in [MEGA_EDU_V2_Master_Roadmap.md](MEGA_EDU_V2_Master_Roadmap.md).
