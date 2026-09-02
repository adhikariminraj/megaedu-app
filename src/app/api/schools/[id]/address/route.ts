import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateAddressInput, isAddressError } from "@/lib/address";

/**
 * Creates or replaces a School's structured Official Address (Address
 * row with label "OFFICIAL", schoolId set). Upserted on the
 * @@unique([schoolId, label]) constraint — a school has exactly one
 * Official Address, same one-row-per-label idea a User has for
 * Current/Permanent. The legacy free-text School.location/district
 * fields are left untouched; this is the new, structured, authoritative
 * source alongside them, not a replacement for them yet.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const validated = await validateAddressInput(await req.json());
  if (isAddressError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const address = await prisma.address.upsert({
    where: { schoolId_label: { schoolId: params.id, label: "OFFICIAL" } },
    update: { ...validated, updatedByUserId: userId },
    create: { ...validated, schoolId: params.id, label: "OFFICIAL", updatedByUserId: userId },
    include: { province: true, district: true, localLevel: true },
  });

  return NextResponse.json({ ok: true, address });
}
