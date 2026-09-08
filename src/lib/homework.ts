import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sectionScopeWhere } from "@/lib/authorize";
import { resolveCurrentPlacement, CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";
import type { CalendarItem, CalendarWindow } from "@/lib/calendar";

/**
 * Today's calendar date in Asia/Kathmandu, as a "YYYY-MM-DD" string.
 * Deliberately NOT `new Date().toISOString().slice(0, 10)` — that
 * reflects the UTC calendar date, which diverges from Nepal's actual
 * local date for roughly the first ~5h45m of every Nepal day (NPT is
 * UTC+5:45), exactly the early-morning window a parent checking
 * "today's homework" before the school day starts is most likely to
 * hit. Hardcoded to this one timezone deliberately — this platform is
 * Nepal-only today, and no School has ever had (or needed) its own
 * timezone field; adding one now would be speculative infrastructure
 * for a scenario that doesn't exist yet.
 */
export function todayInKathmandu(): string {
  // en-CA's locale format is exactly YYYY-MM-DD, so no manual
  // reassembly of Intl's parts is needed.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

export type HomeworkRow = {
  id: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string; // "YYYY-MM-DD"
};

/**
 * Today's PUBLISHED homework applicable to one student, resolved
 * entirely from that student's current institutional placement — never
 * a stored per-student row. Shared by the Student's own dashboard and,
 * once per linked child, the Parent dashboard — the same
 * "one function, every caller" discipline already established by
 * fetchAcademicProgress() (src/lib/academicProgress.ts), so the two
 * views can never drift apart. Callers are responsible for only ever
 * passing a studentId they've already verified the caller is allowed to
 * see — this function itself does no authorization, matching
 * fetchAcademicProgress()'s own documented contract.
 *
 * schoolId scopes the placement lookup via resolveCurrentPlacement()
 * (src/lib/gradeHistory.ts) — required so a student whose GradeHistory
 * touches more than one school (a transfer, or any school whose own
 * session happens to still be open) never resolves an unrelated
 * school's ACTIVE session. Pass the student's own authoritative current
 * schoolId (the bridge field a caller already trusts elsewhere for this
 * same student, e.g. Student.schoolId), never a remembered/default
 * school that could bypass which school's homework is actually shown.
 */
export async function fetchTodaysHomework(studentId: string, schoolId: string | null): Promise<HomeworkRow[]> {
  const currentPlacement = schoolId ? await resolveCurrentPlacement(studentId, schoolId) : null;
  if (!currentPlacement) return [];

  const today = new Date(todayInKathmandu());

  const homework = await prisma.homework.findMany({
    where: {
      status: "PUBLISHED",
      academicSessionId: currentPlacement.academicSessionId,
      schoolGradeId: currentPlacement.schoolGradeId,
      dueDate: today,
      ...sectionScopeWhere(currentPlacement.sectionId),
    },
    include: { subject: true },
    orderBy: { subject: { name: "asc" } },
  });

  return homework.map((hw) => ({
    id: hw.id,
    subjectName: hw.subject.name,
    title: hw.title,
    instructions: hw.instructions,
    dueDate: hw.dueDate.toISOString().slice(0, 10),
  }));
}

function toHomeworkCalendarItem(
  hw: { id: string; title: string; instructions: string; dueDate: Date; subject: { name: string } },
  schoolId: string,
  options?: { link?: string | null; child?: { id: string; name: string } }
): CalendarItem {
  const childName = options?.child?.name;
  // A single Homework row can legitimately project into more than one
  // CalendarItem — two siblings in the same grade/section both get it —
  // so the id must incorporate the child, or React (and any consumer
  // keying off id) sees two items with an identical key.
  const id = options?.child ? `Homework:${hw.id}:${options.child.id}` : `Homework:${hw.id}`;
  return {
    id,
    title: childName ? `${childName} — ${hw.subject.name} — ${hw.title}` : `${hw.subject.name} — ${hw.title}`,
    date: hw.dueDate.toISOString().slice(0, 10),
    time: null,
    isAllDay: true,
    category: "HOMEWORK",
    sourceType: "Homework",
    sourceId: hw.id,
    scopeType: "SCHOOL",
    scopeId: schoolId,
    description: hw.instructions,
    location: null,
    link: options?.link ?? null,
    childId: options?.child?.id,
    childName,
  };
}

/**
 * Calendar K1 — PUBLISHED homework due within a date window for one
 * student. A sibling of fetchTodaysHomework(), not a replacement:
 * identical placement-resolution/sectionScopeWhere() logic, just
 * dueDate widened from an exact match to a range. fetchTodaysHomework()
 * itself is untouched — no existing caller's behavior changes.
 */
export async function fetchHomeworkDueForStudent(
  studentId: string,
  schoolId: string,
  window: CalendarWindow,
  child?: { id: string; name: string }
): Promise<CalendarItem[]> {
  const currentPlacement = await resolveCurrentPlacement(studentId, schoolId);
  if (!currentPlacement) return [];

  const homework = await prisma.homework.findMany({
    where: {
      status: "PUBLISHED",
      academicSessionId: currentPlacement.academicSessionId,
      schoolGradeId: currentPlacement.schoolGradeId,
      dueDate: { gte: new Date(window.from), lte: new Date(window.to) },
      ...sectionScopeWhere(currentPlacement.sectionId),
    },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });

  // No link: no per-student homework detail page exists for
  // Student/Parent today — leaving this null is honest, not an
  // oversight (see docs/CALENDAR.md).
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link: null, child }));
}

/**
 * Calendar K1 — homework a Teacher has authored, due within a date
 * window. Uses the existing [teacherId] index; no per-role filtering
 * beyond teacherId, matching the caller's own already-verified
 * identity, same contract as every other adapter here.
 */
export async function fetchHomeworkForTeacher(
  teacherId: string,
  schoolId: string,
  window: CalendarWindow
): Promise<CalendarItem[]> {
  const homework = await prisma.homework.findMany({
    where: { teacherId, dueDate: { gte: new Date(window.from), lte: new Date(window.to) } },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });
  const link = `/dashboard/schools/${schoolId}/homework`;
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link }));
}

/**
 * Calendar K1 — every homework item due at a school within a date
 * window, School Admin's own scope. Uses the existing
 * [schoolGradeId, dueDate] index via the SchoolGrade join.
 */
export async function fetchHomeworkForSchool(schoolId: string, window: CalendarWindow): Promise<CalendarItem[]> {
  const homework = await prisma.homework.findMany({
    where: {
      schoolGrade: { schoolId },
      dueDate: { gte: new Date(window.from), lte: new Date(window.to) },
    },
    include: { subject: true },
    orderBy: { dueDate: "asc" },
  });
  const link = `/dashboard/schools/${schoolId}/homework`;
  return homework.map((hw) => toHomeworkCalendarItem(hw, schoolId, { link }));
}

// ============================================================
// K1 — Homework Applicability. The only code path allowed to create a
// HomeworkApplicability row, and the only code path allowed to
// transition a Homework from DRAFT to PUBLISHED. See the model comment
// on HomeworkApplicability (schema.prisma) for the full architectural
// rationale — this is its implementation.
// ============================================================

/**
 * Thrown when a Homework can't be published as requested — either it's
 * not actually in DRAFT (caller should treat this as a harmless no-op,
 * not surface it as an error — see publishHomework()'s own return
 * shape), or an Individual Homework's target student no longer
 * satisfies the required institutional context at the moment of
 * publication. Always maps to the status code it carries; never thrown
 * for "already published," which is a success case, not an error.
 */
export class HomeworkPublishError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type PublishHomeworkResult = {
  homework: Prisma.HomeworkGetPayload<{}>;
  /**
   * True only when the homework was already PUBLISHED when this was
   * called — a harmless no-op, matching this route's existing
   * idempotent-publish behavior from before Applicability existed.
   * Internal signal only; the calling route does not need to (and
   * should not) expose this as a new field in its HTTP response — see
   * the route for why.
   */
  alreadyPublished: boolean;
};

/**
 * Resolves the current roster for a Regular Homework's own grade/
 * (optional) section, inside the same transaction as the publish that
 * calls it — never a value read before that transaction began. Reuses
 * the exact "current roster" definition (CURRENT_ROSTER_STATUSES) every
 * other roster-scoped feature in this codebase already shares (Grades
 * index, Class Overview, the bulk assessment-marks-entry roster) —
 * never a separate, independently-invented membership rule.
 */
async function resolveRegularRoster(
  tx: Prisma.TransactionClient,
  homework: Prisma.HomeworkGetPayload<{}>
): Promise<string[]> {
  const roster = await tx.gradeHistory.findMany({
    where: {
      academicSessionId: homework.academicSessionId,
      schoolGradeId: homework.schoolGradeId,
      status: { in: CURRENT_ROSTER_STATUSES },
      ...(homework.sectionId ? { sectionId: homework.sectionId } : {}),
    },
    select: { studentId: true },
  });
  return roster.map((r) => r.studentId);
}

/**
 * Re-validates an Individual Homework's target student is STILL
 * genuinely placed in this homework's own grade/session, fresh, at the
 * exact moment of publication — never trusted from whatever was true
 * when the draft was created or the target was selected. A student who
 * has transferred away (or otherwise no longer has a current-roster
 * GradeHistory row for this exact academicSessionId/schoolGradeId)
 * fails this check and publication is rejected outright, rather than
 * creating a stale HomeworkApplicability row for a student no longer in
 * the context the homework was written for.
 */
async function resolveIndividualTarget(
  tx: Prisma.TransactionClient,
  homework: Prisma.HomeworkGetPayload<{}>
): Promise<string[]> {
  const targetStudentId = homework.targetStudentId!;
  const stillEligible = await tx.gradeHistory.findFirst({
    where: {
      studentId: targetStudentId,
      academicSessionId: homework.academicSessionId,
      schoolGradeId: homework.schoolGradeId,
      status: { in: CURRENT_ROSTER_STATUSES },
    },
  });
  if (!stillEligible) {
    throw new HomeworkPublishError(
      409,
      "The individually assigned student is no longer eligible for this homework — they may have transferred or left this grade."
    );
  }
  return [targetStudentId];
}

/**
 * The one function allowed to transition a Homework from DRAFT to
 * PUBLISHED, and the one function allowed to create
 * HomeworkApplicability rows. Everything — the fresh status re-check,
 * any same-request field edits, roster/target resolution, the
 * Applicability batch insert, and the status flip itself — happens
 * inside one transaction, so publication either fully succeeds
 * (Homework is PUBLISHED with a complete, correct Applicability set) or
 * fully fails (Homework stays DRAFT, no Applicability rows persist at
 * all, and no field edit is left half-applied) — never a partial
 * result.
 *
 * fieldUpdates carries any DRAFT-stage field edits submitted in the
 * SAME PATCH request as the publish (title/instructions/dueDate/
 * sectionId — already validated by the caller). Applied first, inside
 * this transaction, before roster/target resolution — critically, so a
 * sectionId change submitted alongside publish resolves the roster
 * against the NEW section, never a stale pre-edit one.
 *
 * Verified empirically (not assumed) against this repository's actual
 * SQLite configuration, mirroring the exact methodology already proven
 * for AcademicSession transitions (src/lib/academicSession.ts) and
 * assessment-result corrections (src/lib/assessmentResults.ts): a
 * second concurrent call to this function for the SAME homeworkId does
 * not even begin its own read until the first has fully committed, so
 * the fresh `homework.status === "PUBLISHED"` check below is what
 * actually prevents a duplicate Applicability batch — never merely a
 * defensive nicety. @@unique([homeworkId, studentId]) on
 * HomeworkApplicability remains the database-level backstop behind it,
 * exactly as intended, for any path this reasoning hasn't anticipated.
 */
export async function publishHomework(
  homeworkId: string,
  fieldUpdates?: { title?: string; instructions?: string; dueDate?: Date; sectionId?: string | null }
): Promise<PublishHomeworkResult> {
  return prisma.$transaction(async (tx) => {
    let homework = await tx.homework.findUniqueOrThrow({ where: { id: homeworkId } });

    if (homework.status === "PUBLISHED") {
      return { homework, alreadyPublished: true };
    }

    if (fieldUpdates && Object.keys(fieldUpdates).length > 0) {
      homework = await tx.homework.update({ where: { id: homeworkId }, data: fieldUpdates });
    }

    const assignedAt = new Date();
    const studentIds = homework.targetStudentId
      ? await resolveIndividualTarget(tx, homework)
      : await resolveRegularRoster(tx, homework);

    await tx.homeworkApplicability.createMany({
      data: studentIds.map((studentId) => ({ homeworkId: homework.id, studentId, assignedAt })),
    });

    const published = await tx.homework.update({
      where: { id: homeworkId },
      data: { status: "PUBLISHED", publishedAt: assignedAt },
    });

    return { homework: published, alreadyPublished: false };
  });
}
