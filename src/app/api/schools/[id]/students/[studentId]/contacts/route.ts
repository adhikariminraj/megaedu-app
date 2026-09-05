import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import {
  validateFamilyContactInput,
  isFamilyContactError,
  clearOtherPrimaryContacts,
  STUDENT_CONTACT_RELATIONSHIPS,
} from "@/lib/familyContact";

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
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  // Phase 4C: institutional membership resolved via StudentSchoolAffiliation
  // (ACTIVE or PENDING — matches the prior bridge-based check, which had no
  // approved filter of its own), not the Student.schoolId bridge field.
  const affiliation = await prisma.studentSchoolAffiliation.findFirst({
    where: { studentId: student.id, schoolId: params.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (!affiliation) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const validated = validateFamilyContactInput(await req.json(), {
    allowedRelationships: STUDENT_CONTACT_RELATIONSHIPS,
  });
  if (isFamilyContactError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const contact = await prisma.$transaction(async (tx) => {
    // At most one Family Contact per student may hold Primary Contact
    // at a time — clearing it on every existing contact first (even an
    // inactive one) keeps that invariant unconditional, so a later
    // reactivation can never silently create a second primary.
    if (validated.isPrimaryContact) {
      await clearOtherPrimaryContacts(tx, { studentId: params.studentId });
    }
    return tx.familyContact.create({
      data: { ...validated, studentId: params.studentId },
    });
  });

  return NextResponse.json({ ok: true, contact });
}
