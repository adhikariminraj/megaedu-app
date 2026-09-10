import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Revokes one SchoolAccountant grant — School Admin only. Deletes only
 * the SchoolAccountant join row (identified via its own
 * @@unique([userId, schoolId]) key) — never the target User, the
 * School, or their global ACCOUNTANT UserRole flag (which may still be
 * earned/needed elsewhere, e.g. an Organization accountant grant). No
 * history/status is recorded — SchoolAccountant carries none. Mirrors
 * DELETE /api/organizations/[id]/accountants/[userId] exactly.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const requestingUserId = await requireSchoolAdmin(params.id);
  if (!requestingUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const link = await prisma.schoolAccountant.findUnique({
    where: { userId_schoolId: { userId: params.userId, schoolId: params.id } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.schoolAccountant.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
