import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateAddressInput, isAddressError } from "@/lib/address";

/**
 * Creates or replaces a Teacher Family Contact's one optional address
 * (label "CURRENT") — identical shape to the Student contact address
 * route; Address is already owner-agnostic via familyContactId.
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
  if (!contact || contact.teacherId !== params.teacherId || !contact.teacher) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }
  // Phase 4C: institutional membership resolved via TeacherSchoolAffiliation
  // (ACTIVE or PENDING — matches the prior bridge-based check), not the
  // Teacher.schoolId bridge field.
  const affiliation = await prisma.teacherSchoolAffiliation.findFirst({
    where: { teacherId: contact.teacherId!, schoolId: params.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (!affiliation) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

  const validated = await validateAddressInput(await req.json());
  if (isAddressError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const address = await prisma.address.upsert({
    where: { familyContactId_label: { familyContactId: params.contactId, label: "CURRENT" } },
    update: { ...validated, updatedByUserId: adminUserId },
    create: { ...validated, familyContactId: params.contactId, label: "CURRENT", updatedByUserId: adminUserId },
    include: { province: true, district: true, localLevel: true },
  });

  return NextResponse.json({ ok: true, address });
}
