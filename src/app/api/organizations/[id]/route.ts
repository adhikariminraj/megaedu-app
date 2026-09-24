import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";
import { parseOptionalHttpUrl } from "@/lib/safeUrl";

/**
 * This Organization's own settings — Organization Admin only. An
 * Organization Accountant holds no `OrganizationAdmin` row and is
 * correctly rejected by requireOrgAdmin() the same way any other
 * non-admin is.
 *
 * Accepts `academyParticipant` (Academy Participation kilometer) and the
 * self-service profile fields `description` and `website`, mirroring the
 * School Admin's own profile edit (PATCH /api/schools/[id]). `name` and
 * `slug` are deliberately NOT editable here: the name is what a Platform
 * Admin verified, and the slug is the public URL — changing either after
 * verification is a separate, not-yet-decided trust question (see
 * docs/ORGANIZATION_INSTITUTIONAL_CONTEXT.md).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: { academyParticipant?: boolean; description?: string | null; website?: string | null } = {};
  if (typeof body.academyParticipant === "boolean") data.academyParticipant = body.academyParticipant;
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (body.website !== undefined) {
    const site = parseOptionalHttpUrl(body.website, "Website");
    if (!site.ok) return NextResponse.json({ error: site.error }, { status: 400 });
    data.website = site.value;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const updated = await prisma.organization.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, organization: updated });
}
