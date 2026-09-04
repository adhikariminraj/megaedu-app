import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStudentAffiliation, AffiliationError } from "@/lib/affiliation";

// JOIN. Creates a new affiliation with the chosen school. Never ends or
// modifies any affiliation the student already has elsewhere. To end an
// existing affiliation, use /api/student/leave-school; to do both
// atomically, use /api/student/transfer-school.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { schoolId, gradeLevel } = await req.json();
  if (!schoolId) return NextResponse.json({ error: "Please choose a school." }, { status: 400 });

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || !school.verified) {
    return NextResponse.json({ error: "Please choose a verified school." }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

  let affiliation;
  try {
    affiliation = await prisma.$transaction((tx) =>
      createStudentAffiliation(tx, {
        studentId: student.id,
        schoolId,
        status: "PENDING", // joining (or re-joining) a school always needs fresh approval
      })
    );
  } catch (e) {
    if (e instanceof AffiliationError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  // gradeLevel is a bridge-only field (Student has no per-affiliation
  // equivalent yet). Only set it when the bridge fields actually synced
  // to this school (the common 0-or-1-affiliation case) — otherwise the
  // bridge still describes a different school and overwriting gradeLevel
  // alone would make it describe a school schoolId/approved don't.
  const afterJoin = await prisma.student.findUnique({ where: { userId } });
  const updated =
    afterJoin?.schoolId === schoolId
      ? await prisma.student.update({ where: { userId }, data: { gradeLevel: gradeLevel || null } })
      : afterJoin;

  return NextResponse.json({ ok: true, student: updated, affiliation });
}
