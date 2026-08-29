import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Renames and/or activates/deactivates a Subject. There is deliberately
 * no DELETE route — matching Section's precedent, a subject that may
 * already be referenced by a real GradeSubject/TeacherAcademicAssignment
 * row is never removable, only deactivated (isActive: false), which
 * stops it from being offered to new grades or assigned to new teachers
 * without touching any existing row that already points at it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; subjectId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const subject = await prisma.subject.findUnique({ where: { id: params.subjectId } });
  if (!subject || subject.schoolId !== params.id) {
    return NextResponse.json({ error: "Subject not found." }, { status: 404 });
  }

  const body = (await req.json()) as { name?: string; isActive?: boolean };
  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Subject name can't be empty." }, { status: 400 });
    data.name = trimmed;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.subject.update({ where: { id: params.subjectId }, data });
    return NextResponse.json({ ok: true, subject: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Another subject already has that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
