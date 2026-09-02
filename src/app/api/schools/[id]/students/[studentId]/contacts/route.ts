import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateFamilyContactInput, isFamilyContactError } from "@/lib/familyContact";

/**
 * Creates a Family & Emergency Contact administrative record for a
 * Student — School Admin only, same "correction authority" scope as
 * the Address routes. Never touches Parent/ParentStudent/MEGA ID in any
 * way; see the FamilyContact model comment in schema.prisma.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student || student.schoolId !== params.id) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
  }

  const validated = validateFamilyContactInput(await req.json());
  if (isFamilyContactError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const contact = await prisma.$transaction(async (tx) => {
    // At most one Family Contact per student may hold Primary Contact
    // at a time — clearing it on every existing contact first (even an
    // inactive one) keeps that invariant unconditional, so a later
    // reactivation can never silently create a second primary.
    if (validated.isPrimaryContact) {
      await tx.familyContact.updateMany({
        where: { studentId: params.studentId, isPrimaryContact: true },
        data: { isPrimaryContact: false },
      });
    }
    return tx.familyContact.create({
      data: { ...validated, studentId: params.studentId },
    });
  });

  return NextResponse.json({ ok: true, contact });
}
