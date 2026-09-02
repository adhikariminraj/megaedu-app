import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateAddressInput, isAddressError } from "@/lib/address";

/**
 * Creates or replaces a Family Contact's one optional address (label
 * "CURRENT" — a contact has no Current/Permanent distinction, just an
 * address on file). Same validate-then-upsert-by-unique-key shape as
 * the School/Student/Teacher address routes.
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
  if (!contact || contact.studentId !== params.studentId || contact.student.schoolId !== params.id) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

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
