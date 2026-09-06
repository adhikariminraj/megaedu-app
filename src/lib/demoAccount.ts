/**
 * Identifies a seeded demo/test account — every account created by
 * prisma/seed.ts or prisma/seed-demo.ts uses the `@megaedu.local`
 * domain, a fictional, reserved placeholder domain that a real person
 * could never legitimately register with in a live deployment (the
 * bootstrap Platform Admin's own default email is explicitly
 * overridden via SEED_ADMIN_EMAIL before any real deployment — see
 * DEPLOYMENT.md). No new "isDemo" column or seeding convention is
 * introduced here — this reuses the domain choice the seed scripts
 * already made, the same way DEMO_DATA.md already documents
 * `MegaDemo123!` as the one shared password every seeded account uses.
 *
 * Deliberately just a domain check, not a database flag: adding a new
 * schema column for this would be a real (if small) architecture
 * change for a fact that's already fully determined by which email the
 * seed scripts chose.
 */
const DEMO_ACCOUNT_EMAIL_DOMAIN = "@megaedu.local";

export function isDemoAccountEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DEMO_ACCOUNT_EMAIL_DOMAIN);
}
