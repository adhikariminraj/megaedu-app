import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Edit or remove one Opportunity — School Admin only. Like Program, no
 * other model references an Opportunity row (confirmed — `Opportunity`
 * has no reverse relations anywhere in the schema), so a real DELETE is
 * safe here: nothing can be orphaned. Mirrors
 * schools/[id]/programs/[programId]/route.ts exactly.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; opportunityId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opportunity = await prisma.opportunity.findUnique({ where: { id: params.opportunityId } });
  if (!opportunity || opportunity.schoolId !== params.id) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    type?: string;
    deadline?: string | null;
    applyUrl?: string;
  };
  const data: {
    title?: string;
    description?: string | null;
    type?: string;
    deadline?: Date | null;
    applyUrl?: string | null;
  } = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = trimmed;
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.type === "string") {
    const trimmed = body.type.trim();
    if (!trimmed) return NextResponse.json({ error: "Type is required." }, { status: 400 });
    data.type = trimmed;
  }
  if (body.deadline !== undefined) data.deadline = body.deadline ? new Date(body.deadline) : null;
  if (typeof body.applyUrl === "string") data.applyUrl = body.applyUrl.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.opportunity.update({ where: { id: params.opportunityId }, data });
  return NextResponse.json({ ok: true, opportunity: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; opportunityId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const opportunity = await prisma.opportunity.findUnique({ where: { id: params.opportunityId } });
  if (!opportunity || opportunity.schoolId !== params.id) {
    return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });
  }

  await prisma.opportunity.delete({ where: { id: params.opportunityId } });
  return NextResponse.json({ ok: true });
}
