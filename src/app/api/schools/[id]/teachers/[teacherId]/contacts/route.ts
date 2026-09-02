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
 * Creates a Family & Emergency Contact administrative record for a
 * Teacher — School Admin only, mirrors the Student contacts route
 * exactly (see its comment for the shared-record/authorization
 * rationale). `allowGuardianFlag: false` means isGuardian is always
 * stored as false here regardless of what the client sends — Guardian
 * is a Student-only concept, never exposed for Teacher contacts.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string; teacherId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher || teacher.schoolId !== params.id) {
    return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  }

  const validated = validateFamilyContactInput(await req.json(), {
    allowedRelationships: TEACHER_CONTACT_RELATIONSHIPS,
    allowGuardianFlag: false,
  });
  if (isFamilyContactError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (validated.isPrimaryContact) {
      await clearOtherPrimaryContacts(tx, { teacherId: params.teacherId });
    }
    return tx.familyContact.create({
      data: { ...validated, teacherId: params.teacherId },
    });
  });

  return NextResponse.json({ ok: true, contact });
}
