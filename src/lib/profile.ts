/**
 * My Profile K1 — "My Institutional Relationships". Pure presentation
 * shaping over already-fetched, already-authoritative data
 * (TeacherSchoolAffiliation / StudentSchoolAffiliation / SchoolAdmin) —
 * no query of its own, no authorization of its own. The caller (the
 * Profile page) is responsible for having fetched these rows scoped to
 * the session's own userId — this module never accepts or trusts an
 * id from anywhere else.
 *
 * Deliberately read-only: this file does not create, end, or transfer
 * an affiliation — that remains entirely src/lib/affiliation.ts's job,
 * untouched by this kilometer.
 */

export type RelationshipStatus = "ACTIVE" | "PENDING" | "ENDED";

export type InstitutionalRelationship = {
  id: string;
  institutionName: string;
  role: "Teacher" | "Student" | "School Admin";
  // null only for School Admin — that relationship has no status
  // concept in the schema today (see the model-level note below).
  status: RelationshipStatus | null;
  startDate: Date | null;
  startDateSource: "RECORDED" | "UNKNOWN_MIGRATED" | null;
  endDate: Date | null;
};

type AffiliationLike = {
  id: string;
  status: string;
  startDate: Date | null;
  startDateSource: string;
  endDate: Date | null;
  school: { name: string };
};

/**
 * Builds the full relationship list for one person from their
 * already-included Teacher/Student/SchoolAdmin relations. Every
 * relevant period is included — ACTIVE, PENDING, and ENDED alike; this
 * function never filters out history. School Admin rows get status
 * "ACTIVE" and null dates — SchoolAdmin is a flat join table with no
 * status/date columns, so "the row exists" is the entire relationship;
 * this is not an inferred/fabricated status, it's the only value the
 * schema can ever produce for it today.
 */
export function buildInstitutionalRelationships(input: {
  teacherAffiliations?: AffiliationLike[];
  studentAffiliations?: AffiliationLike[];
  administeredSchools?: { id: string; school: { name: string } }[];
}): InstitutionalRelationship[] {
  const rows: InstitutionalRelationship[] = [];

  for (const a of input.teacherAffiliations ?? []) {
    rows.push({
      id: `teacher:${a.id}`,
      institutionName: a.school.name,
      role: "Teacher",
      status: a.status as RelationshipStatus,
      startDate: a.startDate,
      startDateSource: a.startDateSource as "RECORDED" | "UNKNOWN_MIGRATED",
      endDate: a.endDate,
    });
  }

  for (const a of input.studentAffiliations ?? []) {
    rows.push({
      id: `student:${a.id}`,
      institutionName: a.school.name,
      role: "Student",
      status: a.status as RelationshipStatus,
      startDate: a.startDate,
      startDateSource: a.startDateSource as "RECORDED" | "UNKNOWN_MIGRATED",
      endDate: a.endDate,
    });
  }

  for (const a of input.administeredSchools ?? []) {
    rows.push({
      id: `admin:${a.id}`,
      institutionName: a.school.name,
      role: "School Admin",
      status: "ACTIVE",
      startDate: null,
      startDateSource: null,
      endDate: null,
    });
  }

  const statusOrder: Record<string, number> = { ACTIVE: 0, PENDING: 1, ENDED: 2 };
  rows.sort((a, b) => {
    const sa = a.status ? statusOrder[a.status] : 0;
    const sb = b.status ? statusOrder[b.status] : 0;
    if (sa !== sb) return sa - sb;
    const da = a.startDate?.getTime() ?? 0;
    const db = b.startDate?.getTime() ?? 0;
    return db - da; // most recent first within the same status
  });

  return rows;
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function formatMonthYear(d: Date): string {
  return MONTH_YEAR.format(d);
}

/**
 * The one-line period caption for a relationship row — e.g. "Since June
 * 2025", "June 2022 – May 2025", "Requested September 2026". Never
 * fabricates a date: startDateSource "UNKNOWN_MIGRATED" (or a genuinely
 * null startDate) renders as "Start date not recorded" rather than an
 * invented value that looks precise but isn't real.
 */
export function formatRelationshipPeriod(r: InstitutionalRelationship): string {
  const startKnown = !!r.startDate && r.startDateSource === "RECORDED";
  const startLabel = startKnown ? formatMonthYear(r.startDate as Date) : "Not recorded";

  if (r.status === "ENDED") {
    const endLabel = r.endDate ? formatMonthYear(r.endDate) : "Not recorded";
    return `${startLabel} – ${endLabel}`;
  }
  if (r.status === "PENDING") {
    return startKnown ? `Requested ${startLabel}` : "Requested — start date not recorded";
  }
  // ACTIVE (or School Admin's implicit ACTIVE with no date at all)
  return startKnown ? `Since ${startLabel}` : "Start date not recorded";
}
