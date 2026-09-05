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
 * Edits a Family Contact's core fields, and/or toggles isActive. There
 * is deliberately no DELETE route — matching Section/Subject, a Family
 * Contact is never removable once created, only deactivated, so a
 * mistaken entry stays correctable/reversible rather than destructive.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; studentId: string; contactId: string } }
) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contact = await prisma.familyContact.findUnique({
    where: { id: params.contactId },
    include: { student: true },
  });
  if (!contact || contact.studentId !== params.studentId || !contact.student) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }
  // Phase 4C: institutional membership resolved via StudentSchoolAffiliation
  // (ACTIVE or PENDING — matches the prior bridge-based check), not the
  // Student.schoolId bridge field.
  const affiliation = await prisma.studentSchoolAffiliation.findFirst({
    where: { studentId: contact.studentId!, schoolId: params.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (!affiliation) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  const hasCoreFields =
    body.fullName !== undefined || body.relationship !== undefined || body.mobileNumber !== undefined;
  if (hasCoreFields) {
    const validated = validateFamilyContactInput(
      {
        fullName: body.fullName ?? contact.fullName,
        relationship: body.relationship ?? contact.relationship,
        relationshipOther: body.relationshipOther ?? contact.relationshipOther,
        mobileNumber: body.mobileNumber ?? contact.mobileNumber,
        isPrimaryContact: body.isPrimaryContact ?? contact.isPrimaryContact,
        isGuardian: body.isGuardian ?? contact.isGuardian,
        isEmergencyContact: body.isEmergencyContact ?? contact.isEmergencyContact,
      },
      { allowedRelationships: STUDENT_CONTACT_RELATIONSHIPS }
    );
    if (isFamilyContactError(validated)) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    Object.assign(data, validated);
  } else {
    if (typeof body.isPrimaryContact === "boolean") data.isPrimaryContact = body.isPrimaryContact;
    if (typeof body.isGuardian === "boolean") data.isGuardian = body.isGuardian;
    if (typeof body.isEmergencyContact === "boolean") data.isEmergencyContact = body.isEmergencyContact;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isPrimaryContact === true) {
      await clearOtherPrimaryContacts(tx, { studentId: params.studentId }, params.contactId);
    }
    return tx.familyContact.update({ where: { id: params.contactId }, data });
  });

  return NextResponse.json({ ok: true, contact: updated });
}
