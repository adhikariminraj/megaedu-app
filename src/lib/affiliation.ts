import { Prisma, TeacherSchoolAffiliation, StudentSchoolAffiliation } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

const OPEN_STATUSES = ["ACTIVE", "PENDING"] as const;

/**
 * Phase 3 — the JOIN / LEAVE / TRANSFER primitives for
 * TeacherSchoolAffiliation / StudentSchoolAffiliation.
 *
 * These are deliberately three separate, explicit operations, not one
 * "smart" function that guesses intent from flags — see the Phase 3
 * design report for why: a generic function whose default behavior
 * could accidentally end an existing affiliation is exactly the bug
 * this phase exists to remove. JOIN never ends anything. LEAVE never
 * creates anything. TRANSFER is the two composed, atomically, only
 * when that is genuinely the caller's intent.
 *
 * Every function here takes an explicit Prisma transaction client
 * (never the bare `prisma` singleton) so a route can compose
 * create+end atomically for TRANSFER, and so a single JOIN/LEAVE call
 * still gets the same all-or-nothing guarantee between its own
 * affiliation write and its bridge-field sync.
 *
 * On failure (duplicate JOIN, missing LEAVE target) these throw
 * AffiliationError rather than returning an { error } value. A normal
 * return from a prisma.$transaction(async (tx) => ...) callback always
 * commits — only a thrown error rolls it back — so a returned error
 * object would silently commit a half-finished TRANSFER (the END half
 * succeeding while the CREATE half "fails"). Throwing is what makes
 * Prisma actually roll back both halves together, matching this
 * codebase's existing convention (see recordGradeDecision in
 * src/lib/gradeHistory.ts). Routes catch AffiliationError outside the
 * transaction and translate it into the appropriate HTTP response.
 */
export class AffiliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliationError";
  }
}

// ---------------------------------------------------------------------
// Bridge-field synchronization
//
// Teacher.schoolId/approved/position/subjects and Student.schoolId/
// approved remain the live, transitional fields every existing read
// path still uses (Phase 4 territory to convert, not this phase).
//
// A single field cannot represent more than one simultaneously
// ACTIVE/PENDING affiliation — that is exactly why Phase 4 exists, not
// a bug in this sync helper. So the rule here is deliberately narrow
// and never misleading:
//   - 0 open affiliations  -> bridge fields cleared (schoolId: null,
//     approved: false) — matches the existing "no school yet" shape.
//   - 1 open affiliation   -> bridge fields synced to it exactly.
//   - 2+ open affiliations -> bridge fields are left completely
//     untouched. Whatever they currently say remains accurate for
//     whichever single affiliation they already reflected — it is
//     incomplete (it cannot show the second school), never wrong.
// ---------------------------------------------------------------------

export async function syncTeacherBridgeFields(tx: Tx, teacherId: string) {
  const open = await tx.teacherSchoolAffiliation.findMany({
    where: { teacherId, status: { in: [...OPEN_STATUSES] } },
  });
  if (open.length === 0) {
    await tx.teacher.update({ where: { id: teacherId }, data: { schoolId: null, approved: false } });
  } else if (open.length === 1) {
    const a = open[0];
    await tx.teacher.update({
      where: { id: teacherId },
      data: { schoolId: a.schoolId, approved: a.status === "ACTIVE", position: a.position, subjects: a.subjects },
    });
  }
  // open.length >= 2: deliberately left untouched.
}

export async function syncStudentBridgeFields(tx: Tx, studentId: string) {
  const open = await tx.studentSchoolAffiliation.findMany({
    where: { studentId, status: { in: [...OPEN_STATUSES] } },
  });
  if (open.length === 0) {
    await tx.student.update({ where: { id: studentId }, data: { schoolId: null, approved: false } });
  } else if (open.length === 1) {
    const a = open[0];
    await tx.student.update({
      where: { id: studentId },
      data: { schoolId: a.schoolId, approved: a.status === "ACTIVE" },
    });
  }
}

// ---------------------------------------------------------------------
// JOIN (create)
// ---------------------------------------------------------------------

/**
 * JOIN. Creates a new affiliation for (teacherId, schoolId). Never
 * touches any other affiliation the teacher has, at this school or any
 * other — that is the entire point of this phase.
 *
 * Throws AffiliationError if an ACTIVE or PENDING affiliation already
 * exists for this exact (teacherId, schoolId) pair (same-school
 * duplicate protection — enforced here at the application layer, not
 * as a DB constraint, since an ENDED row for the same pair must remain
 * perfectly legal — that's REJOIN). An ENDED row for this school is
 * never a match here, so REJOIN always succeeds.
 */
export async function createTeacherAffiliation(
  tx: Tx,
  params: {
    teacherId: string;
    schoolId: string;
    status: "PENDING" | "ACTIVE";
    position: string;
    subjects: string | null;
    effectiveDate?: Date;
  }
): Promise<TeacherSchoolAffiliation> {
  const existing = await tx.teacherSchoolAffiliation.findFirst({
    where: { teacherId: params.teacherId, schoolId: params.schoolId, status: { in: [...OPEN_STATUSES] } },
  });
  if (existing) {
    throw new AffiliationError("This teacher already has an active or pending affiliation with this school.");
  }

  const affiliation = await tx.teacherSchoolAffiliation.create({
    data: {
      teacherId: params.teacherId,
      schoolId: params.schoolId,
      status: params.status,
      position: params.position,
      subjects: params.subjects,
      // A live JOIN happening right now has a genuinely known,
      // non-fabricated effective date — this is not the Phase 2
      // backfill case, where the true date was already lost.
      startDate: params.effectiveDate ?? new Date(),
      startDateSource: "RECORDED",
      endDate: null,
    },
  });

  await syncTeacherBridgeFields(tx, params.teacherId);
  return affiliation;
}

export async function createStudentAffiliation(
  tx: Tx,
  params: {
    studentId: string;
    schoolId: string;
    status: "PENDING" | "ACTIVE";
    effectiveDate?: Date;
  }
): Promise<StudentSchoolAffiliation> {
  const existing = await tx.studentSchoolAffiliation.findFirst({
    where: { studentId: params.studentId, schoolId: params.schoolId, status: { in: [...OPEN_STATUSES] } },
  });
  if (existing) {
    throw new AffiliationError("This student already has an active or pending affiliation with this school.");
  }

  const affiliation = await tx.studentSchoolAffiliation.create({
    data: {
      studentId: params.studentId,
      schoolId: params.schoolId,
      status: params.status,
      startDate: params.effectiveDate ?? new Date(),
      startDateSource: "RECORDED",
      endDate: null,
    },
  });

  await syncStudentBridgeFields(tx, params.studentId);
  return affiliation;
}

// ---------------------------------------------------------------------
// LEAVE (end)
// ---------------------------------------------------------------------

/**
 * LEAVE. Ends the specific ACTIVE/PENDING affiliation for
 * (teacherId, schoolId). Every other affiliation for that teacher, at
 * any other school, is completely untouched — this function never
 * even queries them except to recompute the bridge fields afterward.
 */
export async function endTeacherAffiliation(
  tx: Tx,
  params: { teacherId: string; schoolId: string; effectiveDate?: Date }
): Promise<TeacherSchoolAffiliation> {
  const existing = await tx.teacherSchoolAffiliation.findFirst({
    where: { teacherId: params.teacherId, schoolId: params.schoolId, status: { in: [...OPEN_STATUSES] } },
  });
  if (!existing) {
    throw new AffiliationError("No active or pending affiliation with this school to leave.");
  }

  const affiliation = await tx.teacherSchoolAffiliation.update({
    where: { id: existing.id },
    data: { status: "ENDED", endDate: params.effectiveDate ?? new Date() },
  });

  await syncTeacherBridgeFields(tx, params.teacherId);
  return affiliation;
}

export async function endStudentAffiliation(
  tx: Tx,
  params: { studentId: string; schoolId: string; effectiveDate?: Date }
): Promise<StudentSchoolAffiliation> {
  const existing = await tx.studentSchoolAffiliation.findFirst({
    where: { studentId: params.studentId, schoolId: params.schoolId, status: { in: [...OPEN_STATUSES] } },
  });
  if (!existing) {
    throw new AffiliationError("No active or pending affiliation with this school to leave.");
  }

  const affiliation = await tx.studentSchoolAffiliation.update({
    where: { id: existing.id },
    data: { status: "ENDED", endDate: params.effectiveDate ?? new Date() },
  });

  await syncStudentBridgeFields(tx, params.studentId);
  return affiliation;
}
