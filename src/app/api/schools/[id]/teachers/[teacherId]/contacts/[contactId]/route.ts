import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import {
  validateFamilyContactInput,
  isFamilyContactError,
  clearOtherPrimaryContacts,
  TEACHER_CONTACT_RELATIONSHIPS,
} from "@/lib/familyContact";

/**
 * Edits a Teacher Family Contact's core fields, and/or toggles
 * isActive — mirrors the Student contacts [contactId] route exactly.
 * No DELETE route, matching Section/Subject/Student-contact precedent.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; teacherId: string; contactId: string } }
) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const contact = await prisma.familyContact.findUnique({
    where: { id: params.contactId },
    include: { teacher: true },
  });
  if (!contact || contact.teacherId !== params.teacherId || contact.teacher?.schoolId !== params.id) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

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
        isEmergencyContact: body.isEmergencyContact ?? contact.isEmergencyContact,
      },
      { allowedRelationships: TEACHER_CONTACT_RELATIONSHIPS, allowGuardianFlag: false }
    );
    if (isFamilyContactError(validated)) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    Object.assign(data, validated);
  } else {
    if (typeof body.isPrimaryContact === "boolean") data.isPrimaryContact = body.isPrimaryContact;
    if (typeof body.isEmergencyContact === "boolean") data.isEmergencyContact = body.isEmergencyContact;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isPrimaryContact === true) {
      await clearOtherPrimaryContacts(tx, { teacherId: params.teacherId }, params.contactId);
    }
    return tx.familyContact.update({ where: { id: params.contactId }, data });
  });

  return NextResponse.json({ ok: true, contact: updated });
}
