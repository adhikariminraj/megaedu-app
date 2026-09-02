import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { validateAddressInput, isAddressError } from "@/lib/address";

const ALLOWED_LABELS = ["CURRENT", "PERMANENT"];

/**
 * School Admin correction authority over a Student's Current/Permanent
 * address. Writes to the SAME Address row (keyed by the student's own
 * userId + label) that the student's own My Profile self-service edit
 * writes to — there is exactly one Current and one Permanent address
 * per MEGA ID, and School Admin correction is a second authorized path
 * to that one institutional record, not a separate school-owned copy.
 *
 * Cross-school access is rejected by checking the student's own
 * schoolId against the school in the URL, the same pattern already used
 * by every other /api/schools/[id]/students/[studentId]/* route.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student || student.schoolId !== params.id) {
    return NextResponse.json({ error: "Student not found." }, { status: 404 });
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
    where: { userId_label: { userId: student.userId, label } },
    update: { ...validated, updatedByUserId: adminUserId },
    create: { ...validated, userId: student.userId, label, updatedByUserId: adminUserId },
    include: { province: true, district: true, localLevel: true },
  });

  return NextResponse.json({ ok: true, address });
}
