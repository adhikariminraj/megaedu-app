/**
 * General Calendar — Kilometer 1 reference data.
 *
 * This is NOT fictional demo data (unlike seed.ts/seed-demo.ts) — it is
 * real, dated Nepal calendar reference content, meant to exist in every
 * environment including a future production one. Deliberately kept as
 * its own script and its own npm command (db:seed:calendar) rather than
 * folded into the demo seeds, matching the design's own distinction
 * between "fictional test fixtures" and "real reference data."
 *
 * Source discipline (see docs/CALENDAR.md):
 * - The Nepal Panchanga Nirnayak Bikash Samiti (npns.gov.np) is the
 *   government body with actual authority to determine festival/
 *   calendar dates; the Ministry of Home Affairs separately gazettes
 *   the official public-holiday list each year.
 * - The concrete dates below (Sep–Dec 2026) were cross-referenced
 *   against a published, dated third-party listing (qppstudio.net,
 *   "Nepal Public Holidays 2026") as a starting point, exactly the
 *   "verify/curate before storing" step this design requires.
 * - Every entry needs re-confirmation against the NPNS determination
 *   and the MoHA gazette before this is treated as a final production
 *   list — see the sourceNote on each row.
 * - January–August 2026 are NOT included here. That range was not
 *   found via this research pass, and per the explicit instruction not
 *   to invent or guess dates, it is left for a follow-up curation pass
 *   rather than fabricated.
 *
 * No lunar/Bikram-Sambat computation happens anywhere in this script —
 * every date below is already a concrete, resolved Gregorian date.
 * Re-run for a future year by appending that year's own verified list,
 * never by projecting a rule forward.
 *
 * Idempotent by (date, title) — no @@unique constraint exists on
 * GeneralCalendarEntry (a deliberate, conservative design choice), so
 * idempotency is enforced here via an explicit find-before-create
 * check rather than a database-level constraint.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_NOTE =
  "Cross-referenced against qppstudio.net 'Nepal Public Holidays 2026' — " +
  "needs re-confirmation against the Nepal Panchanga Nirnayak Bikash Samiti " +
  "determination and the Ministry of Home Affairs holiday gazette before " +
  "being treated as final.";

type Entry = {
  date: string; // "YYYY-MM-DD"
  title: string;
  type: "NATIONAL_HOLIDAY" | "OBSERVANCE" | "MEGA_WIDE_EVENT";
  description?: string;
};

// Sep–Dec 2026 only — see the file-level comment above for why the
// rest of the year isn't here yet.
const ENTRIES: Entry[] = [
  { date: "2026-09-04", title: "Shree Krishna Janmashtami", type: "OBSERVANCE" },
  { date: "2026-09-04", title: "Gaura Parba", type: "OBSERVANCE" },
  { date: "2026-09-14", title: "Haritalika Teej", type: "OBSERVANCE" },
  { date: "2026-09-19", title: "Constitution Day", type: "NATIONAL_HOLIDAY", description: "National Day" },
  { date: "2026-09-25", title: "Indra Jatra", type: "OBSERVANCE" },
  { date: "2026-10-04", title: "Jitiya Parwa", type: "OBSERVANCE" },
  { date: "2026-10-11", title: "Ghatasthapana", type: "OBSERVANCE", description: "Dashain begins" },
  { date: "2026-10-17", title: "Phulpati", type: "OBSERVANCE", description: "Dashain" },
  { date: "2026-10-18", title: "Dashain Holiday", type: "NATIONAL_HOLIDAY" },
  { date: "2026-10-19", title: "Maha Ashtami", type: "NATIONAL_HOLIDAY", description: "Dashain" },
  { date: "2026-10-20", title: "Maha Navami", type: "NATIONAL_HOLIDAY", description: "Dashain" },
  { date: "2026-10-21", title: "Bijaya Dashami", type: "NATIONAL_HOLIDAY", description: "Dashain" },
  { date: "2026-10-22", title: "Papankusha Ekadashi", type: "OBSERVANCE", description: "Dashain" },
  { date: "2026-10-23", title: "Dashain Dwadashi", type: "NATIONAL_HOLIDAY" },
  { date: "2026-11-08", title: "Laxmi Puja", type: "NATIONAL_HOLIDAY", description: "Tihar" },
  { date: "2026-11-09", title: "Gai Tihar", type: "OBSERVANCE", description: "Tihar" },
  { date: "2026-11-10", title: "Goru Tihar / Govardhan Puja", type: "OBSERVANCE", description: "Tihar" },
  { date: "2026-11-11", title: "Bhai Tika", type: "NATIONAL_HOLIDAY", description: "Tihar" },
  { date: "2026-11-11", title: "Phalgunanda Jayanti", type: "OBSERVANCE" },
  { date: "2026-11-12", title: "Tihar Holiday", type: "OBSERVANCE" },
  { date: "2026-11-15", title: "Chhath Parwa", type: "OBSERVANCE" },
  { date: "2026-11-24", title: "Guru Nanak Jayanti", type: "OBSERVANCE" },
  { date: "2026-12-24", title: "Udhauli Parwa / Mangshir Purnima", type: "OBSERVANCE" },
  { date: "2026-12-25", title: "Christmas", type: "NATIONAL_HOLIDAY" },
  { date: "2026-12-30", title: "Tamu Lhosar", type: "OBSERVANCE" },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const entry of ENTRIES) {
    const date = new Date(entry.date);
    const existing = await prisma.generalCalendarEntry.findFirst({
      where: { date, title: entry.title },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.generalCalendarEntry.create({
      data: {
        date,
        title: entry.title,
        type: entry.type,
        description: entry.description ?? null,
        country: "NP",
        sourceNote: SOURCE_NOTE,
        isActive: true,
      },
    });
    created++;
  }

  console.log(`General Calendar seed: ${created} created, ${skipped} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
