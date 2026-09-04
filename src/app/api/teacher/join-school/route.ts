import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeacherAffiliation, AffiliationError } from "@/lib/affiliation";

const POSITIONS = ["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"];

// JOIN. Creates a new affiliation with the chosen school. Never ends or
// modifies any affiliation the teacher already has elsewhere — a
// teacher who is already active at School A and joins School B keeps
// School A untouched. To end an existing affiliation, use
// /api/teacher/leave-school; to do both atomically, use
// /api/teacher/transfer-school.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { schoolId, position, subjects } = await req.json();
  if (!schoolId) return NextResponse.json({ error: "Please choose a school." }, { status: 400 });

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school || !school.verified) {
    return NextResponse.json({ error: "Please choose a verified school." }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return NextResponse.json({ error: "Teacher profile not found." }, { status: 404 });

  let affiliation;
  try {
    affiliation = await prisma.$transaction((tx) =>
      createTeacherAffiliation(tx, {
        teacherId: teacher.id,
        schoolId,
        status: "PENDING", // joining (or re-joining) a school always needs fresh approval
        position: POSITIONS.includes(position) ? position : "Teacher",
        subjects: subjects || null,
      })
    );
  } catch (e) {
    if (e instanceof AffiliationError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  const updated = await prisma.teacher.findUnique({ where: { userId } });
  return NextResponse.json({ ok: true, teacher: updated, affiliation });
}
