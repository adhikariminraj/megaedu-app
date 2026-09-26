import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { describeOfferingDependents } from "@/lib/offering";

/**
 * Removes one subject from a grade's offering for the session it
 * belongs to — only while the offering is EMPTY (finding F8). Later
 * phases attached permanent data to an offering (units and unit-test
 * marks, homework and its audit log, teaching plans, evaluations,
 * meetings, framework overrides, results), so anything that depends on
 * it blocks removal with a 409 that lists it, and every foreign key to
 * GradeSubject is RESTRICT as the database backstop. A CLOSED session's
 * offering is part of that session's record and is never removed.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; schoolGradeId: string; gradeSubjectId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const gradeSubject = await prisma.gradeSubject.findUnique({
    where: { id: params.gradeSubjectId },
    include: { schoolGrade: true, academicSession: true },
  });
  if (
    !gradeSubject ||
    gradeSubject.schoolGrade.schoolId !== params.id ||
    gradeSubject.schoolGradeId !== params.schoolGradeId
  ) {
    return NextResponse.json({ error: "Subject offering not found." }, { status: 404 });
  }
  if (gradeSubject.academicSession.status === "CLOSED") {
    return NextResponse.json(
      { error: "This session is closed — its subject offering is part of that session's record and can't be changed." },
      { status: 409 }
    );
  }

  const inUse = (dependents: string) =>
    NextResponse.json(
      { error: `This subject can't be removed while it has ${dependents}. Only a subject with nothing recorded against it can be removed.` },
      { status: 409 }
    );
  const dependents = await describeOfferingDependents(params.gradeSubjectId);
  if (dependents) return inUse(dependents);

  try {
    await prisma.gradeSubject.delete({ where: { id: params.gradeSubjectId } });
  } catch (err) {
    // A simultaneous request changed things between the check and the
    // delete: it recorded something against this subject (the RESTRICT
    // foreign keys refuse the delete) or removed the subject itself.
    // Look again rather than decode the database error.
    const stillThere = await prisma.gradeSubject.findUnique({ where: { id: params.gradeSubjectId } });
    if (!stillThere) {
      return NextResponse.json({ error: "This subject was already removed — please refresh." }, { status: 409 });
    }
    const nowDependents = await describeOfferingDependents(params.gradeSubjectId);
    if (nowDependents) return inUse(nowDependents);
    throw err;
  }
  return NextResponse.json({ ok: true });
}
