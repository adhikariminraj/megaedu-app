import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endTeacherAffiliation, AffiliationError } from "@/lib/affiliation";

// LEAVE. Ends the teacher's affiliation with the given school only —
// any other school the teacher is affiliated with is untouched.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { schoolId } = await req.json();
  if (!schoolId) return NextResponse.json({ error: "Please choose a school." }, { status: 400 });

  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) return NextResponse.json({ error: "Teacher profile not found." }, { status: 404 });

  let affiliation;
  try {
    affiliation = await prisma.$transaction((tx) => endTeacherAffiliation(tx, { teacherId: teacher.id, schoolId }));
  } catch (e) {
    if (e instanceof AffiliationError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  const updated = await prisma.teacher.findUnique({ where: { userId } });
  return NextResponse.json({ ok: true, teacher: updated, affiliation });
}
