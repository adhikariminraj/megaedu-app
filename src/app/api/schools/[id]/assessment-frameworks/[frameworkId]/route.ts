import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Renames, redescribes, re-scales, and/or activates/deactivates an
 * AssessmentFramework. No DELETE route — matching GradingScale/Subject/
 * Section's precedent, a framework that may already be referenced by a
 * real AssessmentFrameworkAssignment is never removable, only
 * deactivated. Structural edits (components/weights) intentionally stay
 * unrestricted in this phase — no marks exist yet to be invalidated by
 * one; see docs/ASSESSMENT_FRAMEWORK.md for why this must be revisited
 * once Phase 3D-2 introduces real per-student results.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; frameworkId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const framework = await prisma.assessmentFramework.findUnique({ where: { id: params.frameworkId } });
  if (!framework || framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Framework not found." }, { status: 404 });
  }

  const body = (await req.json()) as {
    name?: string;
    description?: string | null;
    gradingScaleId?: string | null;
    isActive?: boolean;
  };

  const data: Prisma.AssessmentFrameworkUpdateInput = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = trimmed;
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.gradingScaleId !== undefined) {
    if (body.gradingScaleId) {
      const scale = await prisma.gradingScale.findUnique({ where: { id: body.gradingScaleId } });
      if (!scale || scale.schoolId !== params.id) {
        return NextResponse.json({ error: "Invalid grading scale." }, { status: 400 });
      }
      data.gradingScale = { connect: { id: body.gradingScaleId } };
    } else {
      data.gradingScale = { disconnect: true };
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.assessmentFramework.update({
      where: { id: params.frameworkId },
      data,
      include: {
        periods: { orderBy: { order: "asc" } },
        components: { orderBy: { order: "asc" } },
        gradingScale: { include: { bands: { orderBy: { order: "asc" } } } },
      },
    });
    return NextResponse.json({ ok: true, framework: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Another framework already has that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
