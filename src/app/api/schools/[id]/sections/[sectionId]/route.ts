import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Renames and/or activates/deactivates a Section. There is deliberately
 * no DELETE route for Section — matching the rest of this schema, a
 * section with real academic history is never removable, only
 * deactivated (isActive: false), which stops it from being offered for
 * new placements/reassignments without touching any existing
 * GradeHistory row that already points at it.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const section = await prisma.section.findUnique({
    where: { id: params.sectionId },
    include: { schoolGrade: true },
  });
  if (!section || section.schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Section not found." }, { status: 404 });
  }

  const body = (await req.json()) as { name?: string; isActive?: boolean };
  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Section name can't be empty." }, { status: 400 });
    data.name = trimmed;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.section.update({ where: { id: params.sectionId }, data });
    return NextResponse.json({ ok: true, section: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Another section in this grade already has that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
