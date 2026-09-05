import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateAddressInput, isAddressError } from "@/lib/address";

const ALLOWED_LABELS = ["CURRENT", "PERMANENT"];

/**
 * School Admin correction authority over a Teacher's Current/Permanent
 * address — mirrors the Student address route exactly (see its comment
 * for the shared-record rationale). Cross-school access is rejected by
 * checking the teacher's own schoolId against the school in the URL.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; teacherId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const teacher = await prisma.teacher.findUnique({ where: { id: params.teacherId } });
  if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  // Phase 4C: institutional membership resolved via TeacherSchoolAffiliation
  // (ACTIVE or PENDING — matches the prior bridge-based check, which had no
  // approved filter of its own), not the Teacher.schoolId bridge field.
  const affiliation = await prisma.teacherSchoolAffiliation.findFirst({
    where: { teacherId: teacher.id, schoolId: params.id, status: { in: ["ACTIVE", "PENDING"] } },
  });
  if (!affiliation) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
  // See the identical guard in the Student address route — Address is
  // still keyed on the linked User (Phase A/B design); reconciling that
  // with User-less institutional records is deliberately deferred.
  if (!teacher.userId) {
    return NextResponse.json(
      { error: "This teacher has no linked MEGA account yet — an address cannot be set until one is linked." },
      { status: 400 }
    );
  }

  const body = await req.json();
  const label = typeof body.label === "string" ? body.label : "";
  if (!ALLOWED_LABELS.includes(label)) {
    return NextResponse.json({ error: "Label must be CURRENT or PERMANENT." }, { status: 400 });
  }

  const validated = await validateAddressInput(body);
  if (isAddressError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const address = await prisma.address.upsert({
    where: { userId_label: { userId: teacher.userId, label } },
    update: { ...validated, updatedByUserId: adminUserId },
    create: { ...validated, userId: teacher.userId, label, updatedByUserId: adminUserId },
    include: { province: true, district: true, localLevel: true },
  });

  return NextResponse.json({ ok: true, address });
}
