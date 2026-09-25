# MEGA.EDU V2 — Master Roadmap

> **A planning reference only. Nothing in this document is approved, scheduled, or authorized for implementation.** Each block below becomes real only when the project owner selects it, a 10-KM BLOCK PLAN is written against the repository *at that time*, and that plan is explicitly approved (see [How to use this roadmap](#how-to-use-this-roadmap)).
> **Baseline**: repository `120316d` (2026-09-24); written 2026-09-25. Current status of every area: [MEGA_EDU_V2_Development_Status.md](MEGA_EDU_V2_Development_Status.md). Technical reference: [MEGA_EDU_V2_Technical_Documentation.md](MEGA_EDU_V2_Technical_Documentation.md).
> **Principle**: *See the whole journey. Build only the next safe kilometer.* Development is **additive → compatible → reusable → minimal** — never rewrite, replace or rebuild what works.

---

## How to use this roadmap

1. **Pick a block** (the project owner decides; the order below is a recommendation based on dependencies and risk, not a calendar).
2. **Re-audit the repository** — this roadmap describes the state at `120316d`; anything may have changed.
3. **Write the 10-KM BLOCK PLAN** (objective, why now, existing foundation, five-way gap classification, protected features, reusable assets, ~10 kilometers) and get approval.
4. **Resolve the block's decision gates** (listed below) *before* the kilometers that depend on them.
5. **Execute kilometer by kilometer**, verifying new **and** existing behaviour; stop for any unanticipated architectural question.
6. **Final block audit**, then the owner chooses what comes next.

The candidate kilometers listed under each block are **illustrative**. They show the block can be divided into roughly ten coherent steps; they are not a task list. Not every gap needs to become work — some should remain deliberately deferred.

---

## Recommended order (dependency view)

```
PROTECT & CONNECT        STRENGTHEN                 EXPAND                  MONETIZE          CONNECT & DEVELOP
─────────────────        ──────────                 ──────                  ────────          ─────────────────
B1 Foundation maturity → B3 Organization maturity → B5 Shared services   → B6 Payments   → B7 Marketplace
B2 Account security &    B4 Academy maturity                               & entitlements  B8 Evidence & insight
   trust foundations                                                                        B9 Professional identity
B10 Engineering readiness (parallel track — before any real deployment)                     B11 Holistic development
```

- **B1, B2, B10** protect what exists and should precede anything that invites real users at scale.
- **B3 before B4's provider-facing pieces**: Academy maturity leans on a mature Organization context.
- **B6 before B7**: a marketplace is impossible without payments and entitlements.
- **B8, B9, B11** depend on richer evidence across domains and need product definition first.

---

## B1 — Foundation maturity & documentation alignment

**Objective**: make every already-built School/Parent/Student capability fully reachable, consistent and correctly documented.
**Why**: the audit found small, evidenced gaps in mature areas plus stale older docs. These are low-risk, high-trust fixes.
**Existing foundation**: the School academic system, `resolveCurrentPlacement`, the institutional-context chooser patterns, `safeUrl.ts`, and the living docs.

Candidate kilometers:
1. Re-audit and confirm scope.
2. Student/Parent navigation to Report Card and Mark Sheet (authorization already exists; only a link is missing).
3. School opportunity `applyUrl` write validation (reuse `parseOptionalHttpUrl`).
4. Migrate Initial Setup to the institutional-context pattern.
5. Migrate New Session the same way.
6. Migrate Assessment Frameworks the same way.
7. Migrate Assessment Results the same way.
8. Documentation alignment — the 12 reconciliation items in Technical Documentation Appendix B.
9. CHANGELOG backfill for the four undocumented September commits.
10. Final audit.

**Decision gates**: whether an in-app "add School Admin" capability is wanted (and who may grant it); whether `/api/auth/register-organization` stays or is retired.
**Protected**: assignment-scoped authority; Report Card/Mark Sheet access rules (only navigation changes).

## B2 — Account security & trust foundations

**Objective**: basic account safety and platform trust controls before real-world scale.
**Existing foundation**: NextAuth credentials, `bcrypt`, password change, `verified`/`isActive` flags (read everywhere, never written), Platform Admin dashboard.

Candidate kilometers:
1. Audit.
2. Delivery-channel decision (email/SMS provider).
3. Password reset.
4. Email verification.
5. Login/registration rate limiting.
6. Session revocation.
7. An audited School/Organization deactivation action (makes existing `isActive` checks meaningful).
8. Platform Admin user lookup/suspension basics.
9. An audit log of admin decisions.
10. Final audit.

**Decision gates**: external email/SMS provider; suspension policy; who may deactivate an institution.
**Protected**: MEGA ID; JWT/session model unless explicitly redesigned; demo-account protections.

## B3 — Organization maturity

**Objective**: bring Organization institutional context closer to School's maturity, without copying School's affiliation model where it isn't needed.
**Existing foundation**: `OrganizationAdmin`/`OrganizationAccountant`, `getAccessibleOrganizations()`, `verifyOrgAccess()`, `requireOrgAdmin`, the 2026-09-24 visibility/link-safety/profile work.

Candidate kilometers:
1. Audit.
2. **C2.3** — a 2+-organization chooser (mirroring `SchoolChooser`; decision required).
3. Adopt `verifyOrgAccess()` where appropriate.
4. Second Organization Admin grant.
5. Organization Admin revoke (with an orphaning rule).
6. Name/slug change policy (re-verification?).
7. **C2.2** decision — role history, only if a consumer exists.
8. Organization calendar page (reusing the calendar projection layer).
9. Define the Organization Accountant's future scope (ties to B6).
10. Final audit.

**Decision gates**: C2.3 shape (chooser vs URL-scoped routes); co-admin governance; re-verification on rename.
**Protected**: School ≠ Organization separation; flat join tables unless a real history consumer appears; `academyParticipant` scoped to Academy only.

## B4 — MEGA Academy maturity

**Objective**: turn the working course loop into a trustworthy learning record.
**Existing foundation**: `Course`/`CourseModule`/`Lesson`, K10/K12 authoring and integrity rules, user-centric `CourseEnrollment`, `issueCourseCertificate()`, `issuerType`, My Courses, provider counts.

Candidate kilometers:
1. Audit.
2. Completion-evidence design (per-lesson completion keyed to `CourseEnrollment`).
3. Real progress calculation.
4. Completion gated on evidence.
5. Verify-page privacy decision (MEGA ID display).
6. Certificate PDF.
7. Certificate QR.
8. Certificate issuer expansion (`SCHOOL`/`JOINT`) — design first.
9. Instructor capability design (currently inert; implement only if approved).
10. Final audit.

Later candidates, needing their own block: quizzes/assessment, Programs (distinct from the D3 Organization Programs question), cohorts, live/blended delivery.
**Decision gates**: what counts as "completed"; privacy on public verification; who may issue school/joint certificates; whether an Instructor becomes a role.
**Protected**: `CourseEnrollment.userId` identity; `Course.organizationId`; certificate recipient/instructor/issuer separation; existing certificates never altered retroactively.

## B5 — Shared services

**Objective**: make the network useful beyond school administration — discoverable resources, opportunities and events.
**Existing foundation**: `Resource`/`Opportunity`/`Event` polymorphic ownership, `eligibleContentOwnerWhere()`, the `/schools` search pattern, and the approach catalog.

Candidate kilometers:
1. Audit.
2. Resources search/filter (subject, grade, approach).
3. School-side resource posting (decision: who at a school).
4. Resource file upload (reuse `uploads.ts` validation).
5. Opportunity discovery improvements.
6. Opportunity application/registration model (design first).
7. Public event discovery across institutions.
8. Approach catalog management by Platform Admin.
9. School public-page presentation improvements (not a website builder).
10. Final audit.

**Decision gates**: school posting authority; whether "applying" for an opportunity is tracked in MEGA.EDU at all.
**Protected**: owner-eligibility rule; link safety; Event soft-deactivate convention.

## B6 — Payments & entitlements

**Objective**: enable paid learning safely.
**Existing foundation**: `Course.priceCents` (paid enrollment deliberately blocked), unused `Subscription`/`Payment` models (school-subscription-shaped), `requireOrgFinance`/`requireSchoolFinance`, Accountant dashboards.

Candidate kilometers:
1. Audit.
2. Product/entitlement/revenue rules (decision).
3. Review whether `Subscription`/`Payment` fit or need an additive redesign.
4. Payment provider integration (eSewa/Khalti or other).
5. Entitlement check on enrollment.
6. Receipts.
7. Refunds.
8. Organization finance view (activate Accountant scope).
9. School finance view if in scope.
10. Final audit.

**Decision gates**: provider; who holds funds; revenue split; refund policy; tax/receipt obligations.
**Protected**: free enrollment keeps working unchanged; `CourseEnrollment.userId`; nothing retroactive for existing enrollments.

## B7 — Marketplace

**Objective**: a provider marketplace for courses, resources and educational services.
**Depends on**: B6 (payments/entitlements), B3 (mature providers), B5 (resource model). **Not designable responsibly before those exist.** Candidate kilometers are to be defined after B6.

## B8 — Evidence & insight (analytics)

**Objective**: meaningful, authorized insight for schools, organizations and the platform, without breaking data ownership or privacy.
**Existing foundation**: live calculation engines (assessment, homework rollups, Academic Snapshot), provider learner counts, Platform Admin counts.
**Candidates**: school-level academic dashboards (addressing unbounded-query scale first), School Admin homework rollup, organization course analytics, platform growth metrics, a privacy/consent model.
**Decision gates**: who may see aggregated data; retention.

## B9 — Professional identity & ecosystem integration

**Objective**: connect a person's learning and professional record across domains.
**Existing foundation**: MEGA ID, affiliation history (My Profile), certificates addressed by `User.id`.
**Candidates**: a teacher professional record (affiliations + Academy certificates), school recognition of Academy professional development, cross-domain certificate views.
**Decision gates**: ownership and visibility of a person's cross-institution record.

## B10 — Engineering readiness (parallel track)

**Objective**: make the codebase deployable and safely changeable at scale.
**Existing foundation**: a disciplined manual verification process, `db:verify:demo`, and documentation.

Candidate kilometers:
1. Audit.
2. Automated test harness (authorization matrix first).
3. Fix the two SQLite-specific bulk-write routes. — *done 2026-09-25 (PG-KM2, `60b23b5`)*
4. PostgreSQL trial migration. — *done in development 2026-09-25 (PG-KM3–PG-KM10, branch `pg-foundation`, not merged; findings F1–F7 open)*
5. Object-storage adapter in `uploads.ts`.
6. Environment/secrets hardening.
7. Deployment target decision.
8. CI pipeline. — *partly: a GitHub Actions workflow for Prisma migrations exists (PG-KM3); no build/test CI*
9. Performance review of unbounded queries.
10. Final audit.

**Decision gates**: hosting platform; database provider (*PostgreSQL decided; hosting provider still open — D3*); storage provider.
**Protected**: `db push` discipline until an explicit migration strategy is approved (*approved 2026-09-25 — decision D5: reviewed `prisma migrate` migrations, `db push` retired*); protected PDFs and docs.

## B11 — Holistic development (long-term vision)

**Objective**: extend MEGA.EDU from managing education toward supporting whole-person development.
**Current state**: 🔵 conceptual only. Related existing building blocks (evaluations, co-scholastic areas, interests, skills) were not designed for this and must not be re-described as such.
**First step, when chosen**: a product-definition block (what is measured, by whom, owned by whom, and why) — no schema until that exists.

---

## Deliberately not on this roadmap

- **Rebuilding** any ✅ area to match a plan.
- A **Person/Learner identity layer** — evaluated and rejected; `User.id` serves.
- A generic **institution model** merging School and Organization.
- **Speculative schema** "reserved" for future concepts.

---

## Development gate (apply to every block and kilometer)

From the V2 Master Development Plan, answered in every 10-KM BLOCK PLAN:
1. Which level: Core, Domain, Shared Service, Platform Service, or Vision?
2. Is it an existing capability, an extension, a new capability, or a future concept?
3. What must remain unchanged?
4. Which person, role, institution or learner is involved?
5. What relationship establishes the context?
6. Who owns the resulting data?
7. What evidence does it create?
8. How is authorization determined — which existing primitive?
9. Does it introduce a School-only assumption into a broader feature?
10. Does it create a new identity or duplicate a source of truth?
11. Is it a security fix, architectural protection, UX refinement, or new capability?
12. What is the smallest safe kilometer?

Working method: the 10-KM block protocol (plan → approve → execute kilometer by kilometer → verify new + existing behaviour → final audit → commit/push only when approved).
