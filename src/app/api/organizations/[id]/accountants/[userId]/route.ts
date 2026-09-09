import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

/**
 * Revokes one OrganizationAccountant grant — Organization Admin only.
 * Deletes only the OrganizationAccountant join row (identified via its
 * own @@unique([userId, organizationId]) key, the same idiom already
 * used for SchoolApproach removal) — never the target User, the
 * Organization, or their global ACCOUNTANT UserRole flag (which may
 * still be earned/needed elsewhere, e.g. a School accountant grant).
 * No history/status is recorded — OrganizationAccountant carries none,
 * matching SchoolAdmin/SchoolAccountant's existing flat, historyless
 * shape (see the Organization Institutional Context design report).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const requestingUserId = await requireOrgAdmin(params.id);
  if (!requestingUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const link = await prisma.organizationAccountant.findUnique({
    where: { userId_organizationId: { userId: params.userId, organizationId: params.id } },
  });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.organizationAccountant.delete({ where: { id: link.id } });
  return NextResponse.json({ ok: true });
}
