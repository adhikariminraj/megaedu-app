import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";
import { parseOptionalHttpUrl } from "@/lib/safeUrl";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, type, deadline, applyUrl } = await req.json();
  if (!title?.trim() || !type?.trim()) {
    return NextResponse.json({ error: "Title and type are required." }, { status: 400 });
  }
  const apply = parseOptionalHttpUrl(applyUrl, "Apply link");
  if (!apply.ok) return NextResponse.json({ error: apply.error }, { status: 400 });

  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId: params.id,
      title,
      description,
      type,
      deadline: deadline ? new Date(deadline) : null,
      applyUrl: apply.value,
    },
  });

  return NextResponse.json({ ok: true, opportunity });
}
