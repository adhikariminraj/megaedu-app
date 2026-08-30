import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { ENTRY_MODES, componentCollisionExists } from "@/lib/assessmentFramework";

/** Renames/re-weights/re-modes a component. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; frameworkId: string; componentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const component = await prisma.assessmentComponent.findUnique({
    where: { id: params.componentId },
    include: { framework: true },
  });
  if (
    !component ||
    component.frameworkId !== params.frameworkId ||
    component.framework.schoolId !== params.id
  ) {
    return NextResponse.json({ error: "Component not found." }, { status: 404 });
  }

  const body = (await req.json()) as { name?: string; maxMarks?: number; entryMode?: string };
  const data: { name?: string; maxMarks?: number; entryMode?: string } = {};

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    if (
      trimmed !== component.name &&
      (await componentCollisionExists({
        frameworkId: component.frameworkId,
        periodId: component.periodId,
        name: trimmed,
      }))
    ) {
      return NextResponse.json(
        { error: "A component with that name already exists in this scope." },
        { status: 409 }
      );
    }
    data.name = trimmed;
  }
  if (typeof body.maxMarks === "number") {
    if (body.maxMarks <= 0) return NextResponse.json({ error: "maxMarks must be greater than 0." }, { status: 400 });
    data.maxMarks = body.maxMarks;
  }
  if (typeof body.entryMode === "string") {
    if (!ENTRY_MODES.includes(body.entryMode as any)) {
      return NextResponse.json({ error: `Invalid entryMode: ${body.entryMode}` }, { status: 400 });
    }
    data.entryMode = body.entryMode;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.assessmentComponent.update({ where: { id: params.componentId }, data });
  return NextResponse.json({ ok: true, component: updated });
}

/** Removes a component — see periods/[periodId]/route.ts DELETE for the non-audited reasoning. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; frameworkId: string; componentId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const component = await prisma.assessmentComponent.findUnique({
    where: { id: params.componentId },
    include: { framework: true },
  });
  if (
    !component ||
    component.frameworkId !== params.frameworkId ||
    component.framework.schoolId !== params.id
  ) {
    return NextResponse.json({ error: "Component not found." }, { status: 404 });
  }

  await prisma.assessmentComponent.delete({ where: { id: params.componentId } });
  return NextResponse.json({ ok: true });
}
