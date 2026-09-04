import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStudentAffiliation, endStudentAffiliation, AffiliationError } from "@/lib/affiliation";

// TRANSFER. Atomically ends the student's affiliation with
// fromSchoolId and creates a new one with toSchoolId, as a single
// transaction. Both primitives throw AffiliationError on failure, so
// if the CREATE half fails after the END half already ran inside this
// same transaction, Prisma rolls the whole transaction back — the END
// is never committed. TRANSFER either succeeds completely or changes
// nothing. Any other affiliation the student has, at a school that is
// neither fromSchoolId nor toSchoolId, is untouched.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { fromSchoolId, toSchoolId, gradeLevel } = await req.json();
  if (!fromSchoolId || !toSchoolId) {
    return NextResponse.json({ error: "Please choose both the current and the new school." }, { status: 400 });
  }
  if (fromSchoolId === toSchoolId) {
    return NextResponse.json({ error: "The new school must be different from the current one." }, { status: 400 });
  }

  const toSchool = await prisma.school.findUnique({ where: { id: toSchoolId } });
  if (!toSchool || !toSchool.verified) {
    return NextResponse.json({ error: "Please choose a verified school." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const ended = await endStudentAffiliation(tx, { studentId: student.id, schoolId: fromSchoolId });
      const created = await createStudentAffiliation(tx, {
        studentId: student.id,
        schoolId: toSchoolId,
        status: "PENDING", // transferring to a school always needs fresh approval
      });
      return { ended, created };
    });
  } catch (e) {
    if (e instanceof AffiliationError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  // gradeLevel is a bridge-only field — only set it when the bridge
  // fields actually synced to the new school (the common case).
  const afterTransfer = await prisma.student.findUnique({ where: { userId } });
  const updated =
    afterTransfer?.schoolId === toSchoolId
      ? await prisma.student.update({ where: { userId }, data: { gradeLevel: gradeLevel || null } })
      : afterTransfer;

  return NextResponse.json({ ok: true, student: updated, ...result });
}
