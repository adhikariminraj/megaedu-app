import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

/**
 * Edit or remove one Organization Resource — Organization Admin only.
 * Hard DELETE is safe: Resource has no reverse relations anywhere in
 * the schema (same justification already established for Opportunity
 * in K3). Mirrors schools/[id]/opportunities/[opportunityId]/route.ts's
 * ownership-verification shape, adapted to Resource's own fields.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; resourceId: string } }
) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resource = await prisma.resource.findUnique({ where: { id: params.resourceId } });
  if (!resource || resource.organizationId !== params.id) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    fileUrl?: string;
    subject?: string;
    gradeLevel?: string;
    approachId?: string | null;
  };
  const data: {
    title?: string;
    description?: string | null;
    fileUrl?: string | null;
    subject?: string | null;
    gradeLevel?: string | null;
    approachId?: string | null;
  } = {};

  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = trimmed;
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.fileUrl === "string") data.fileUrl = body.fileUrl.trim() || null;
  if (typeof body.subject === "string") data.subject = body.subject.trim() || null;
  if (typeof body.gradeLevel === "string") data.gradeLevel = body.gradeLevel.trim() || null;
  if (body.approachId !== undefined) data.approachId = body.approachId || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.resource.update({ where: { id: params.resourceId }, data });
  return NextResponse.json({ ok: true, resource: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; resourceId: string } }
) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resource = await prisma.resource.findUnique({ where: { id: params.resourceId } });
  if (!resource || resource.organizationId !== params.id) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  await prisma.resource.delete({ where: { id: params.resourceId } });
  return NextResponse.json({ ok: true });
}
