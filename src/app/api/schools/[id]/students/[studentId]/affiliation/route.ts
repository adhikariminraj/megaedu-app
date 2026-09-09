import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { resolveOpenStudentAffiliation } from "@/lib/affiliation";

const MAX_ADMISSION_NUMBER_LENGTH = 50;

/**
 * School Admin correction authority over the school-specific
 * admissionNumber ("Student ID" in the UI) on this student's OPEN
 * StudentSchoolAffiliation at this school — affiliation METADATA, not
 * a lifecycle transition. Deliberately never touches status/startDate/
 * endDate; JOIN/LEAVE/TRANSFER/approve (src/lib/affiliation.ts) remain
 * the only code paths allowed to change those. An ENDED affiliation is
 * never reachable here — resolveOpenStudentAffiliation() only ever
 * resolves ACTIVE/PENDING — so historical correction of a past
 * affiliation's admissionNumber is deliberately out of scope for this
 * route (a separate, deliberate administrative-history feature, per
 * the approved design).
 *
 * Validation: trim whitespace only, empty string -> null, max 50
 * chars, no case normalization — "HSS-0087" and "hss-0087" are
 * different values, by design (no elaborate identifier-normalization
 * system). @@unique([schoolId, admissionNumber]) on the model is the
 * real duplicate guard; a P2002 here means another OPEN or ENDED
 * affiliation at this exact school already holds this exact value.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const affiliation = await resolveOpenStudentAffiliation(student.id, params.id);
  if (!affiliation) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const body = await req.json();
  if (!("admissionNumber" in body)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const raw = body.admissionNumber;
  if (raw !== null && typeof raw !== "string") {
    return NextResponse.json({ error: "Enter a valid Student ID." }, { status: 400 });
  }
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed.length > MAX_ADMISSION_NUMBER_LENGTH) {
    return NextResponse.json(
      { error: `Student ID must be ${MAX_ADMISSION_NUMBER_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }
  const admissionNumber = trimmed === "" ? null : trimmed;

  try {
    await prisma.studentSchoolAffiliation.update({
      where: { id: affiliation.id },
      data: { admissionNumber },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "That Student ID is already in use at this school." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, admissionNumber });
}
