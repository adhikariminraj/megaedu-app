import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeacherAffiliation, endTeacherAffiliation, AffiliationError } from "@/lib/affiliation";

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"];

// TRANSFER. Atomically ends the teacher's affiliation with fromSchoolId
// and creates a new one with toSchoolId, as a single transaction. Both
// primitives throw AffiliationError (rather than returning an error
// value) on failure, so if the CREATE half fails after the END half
// already ran inside this same transaction, Prisma rolls the whole
// transaction back — the END is never committed. TRANSFER either
// succeeds completely or changes nothing. Any other affiliation the
// teacher has, at a school that is neither fromSchoolId nor
// toSchoolId, is untouched.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { fromSchoolId, toSchoolId, position, subjects } = await req.json();
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

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return NextResponse.json({ error: "Teacher profile not found." }, { status: 404 });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const ended = await endTeacherAffiliation(tx, { teacherId: teacher.id, schoolId: fromSchoolId });
      const created = await createTeacherAffiliation(tx, {
        teacherId: teacher.id,
        schoolId: toSchoolId,
        status: "PENDING", // transferring to a school always needs fresh approval
        position: POSITIONS.includes(position) ? position : "Teacher",
        subjects: subjects || null,
      });
      return { ended, created };
    });
  } catch (e) {
    if (e instanceof AffiliationError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  const updated = await prisma.teacher.findUnique({ where: { userId } });
  return NextResponse.json({ ok: true, teacher: updated, ...result });
}
