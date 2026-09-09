import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Removes this school's link to one EducationalApproach — School Admin
 * only. Deletes only the SchoolApproach join row (identified via its
 * own @@unique([schoolId, approachId]) key, the same idiom already used
 * by the seed script) — never the EducationalApproach itself, and never
 * any Course/Resource that also references the approach.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; approachId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const link = await prisma.schoolApproach.findUnique({
    where: { schoolId_approachId: { schoolId: params.id, approachId: params.approachId } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.schoolApproach.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
