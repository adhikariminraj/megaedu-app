import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";
import { syncStudentBridgeFields } from "@/lib/affiliation";

export async function POST(
  _req: Request,
  { params }: { params: { id: string; studentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const school = await prisma.school.findUnique({ where: { id: params.id }, select: { name: true } });

  // See the Teacher approve route for why this resolves the requested
  // relationship via the affiliation table for (studentId, schoolId)
  // rather than the single-valued Student.schoolId bridge field, and
  // why it falls back to the original direct write only when no
  // affiliation row exists for this exact (student, school) pair.
  const approved = await prisma.$transaction(async (tx) => {
    const affiliation = await tx.studentSchoolAffiliation.findFirst({
      where: { studentId: params.studentId, schoolId: params.id },
      orderBy: { createdAt: "desc" },
    });
    if (affiliation) {
      if (affiliation.status === "PENDING") {
        await tx.studentSchoolAffiliation.update({ where: { id: affiliation.id }, data: { status: "ACTIVE" } });
      } else if (affiliation.status !== "ACTIVE") {
        return false; // ENDED — nothing pending at this school to approve
      }
      await syncStudentBridgeFields(tx, params.studentId);
      return true;
    }
    if (student.schoolId !== params.id) return false; // no relationship with this school at all
    await tx.student.update({ where: { id: params.studentId }, data: { approved: true } });
    return true;
  });
  if (!approved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Nothing to notify if this student has no linked MEGA account yet.
  if (student.userId) {
    await notify(
      student.userId,
      "STUDENT_APPROVED",
      `You're approved at ${school?.name || "your school"}!`,
      "Your account is now active — you have full access to your school dashboard."
    );
  }

  return NextResponse.json({ ok: true });
}
