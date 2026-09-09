import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { resolveOpenStudentAffiliation } from "@/lib/affiliation";

/**
 * School Admin correction authority over Student-LEVEL identity
 * fields — currently just dateOfBirth (a property of the person, not
 * of any one school relationship, so it lives here rather than on
 * StudentSchoolAffiliation; see the school-specific admissionNumber /
 * "Student ID" route in ./affiliation instead). Cross-school access is
 * rejected via the student's own OPEN StudentSchoolAffiliation at this
 * school, the same pattern the sibling Address route already uses —
 * never the Student.schoolId bridge field alone.
 *
 * Date-only semantics, matching this codebase's existing convention
 * for date-only values (Attendance.date, AcademicSession.startDate):
 * "YYYY-MM-DD" parsed via new Date(...), giving UTC midnight, never a
 * timezone-relative "now" computation — a birth date has no "which
 * timezone is today" ambiguity to resolve. `dateOfBirth: null` (or an
 * empty string) clears the field.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const student = await prisma.student.findUnique({ where: { id: params.studentId } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const affiliation = await resolveOpenStudentAffiliation(student.id, params.id);
  if (!affiliation) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const body = await req.json();
  if (!("dateOfBirth" in body)) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  const raw = body.dateOfBirth;

  let dateOfBirth: Date | null = null;
  if (raw !== null && raw !== "") {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Enter a valid date of birth." }, { status: 400 });
    }
    if (parsed.getTime() > Date.now()) {
      return NextResponse.json({ error: "Date of birth cannot be in the future." }, { status: 400 });
    }
    dateOfBirth = parsed;
  }

  await prisma.student.update({ where: { id: student.id }, data: { dateOfBirth } });
  return NextResponse.json({ ok: true, dateOfBirth: dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null });
}
