import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

/**
 * Organization Academy Participation kilometer — the smallest dedicated
 * write path for this Organization's own settings. Today the only
 * field it accepts is `academyParticipant`; deliberately not a general
 * Organization profile-edit route (that remains a separate, undesigned
 * gap — see docs/ORGANIZATION_INSTITUTIONAL_CONTEXT.md). Organization
 * Admin only — an Organization Accountant holds no `OrganizationAdmin`
 * row and is correctly rejected by requireOrgAdmin() the same way any
 * other non-admin is.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.academyParticipant === "boolean") data.academyParticipant = body.academyParticipant;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.organization.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, organization: updated });
}
