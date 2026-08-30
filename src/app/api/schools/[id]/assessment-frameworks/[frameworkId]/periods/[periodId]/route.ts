import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/** Renames a period. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; frameworkId: string; periodId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await prisma.assessmentPeriod.findUnique({
    where: { id: params.periodId },
    include: { framework: true },
  });
  if (!period || period.frameworkId !== params.frameworkId || period.framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Period not found." }, { status: 404 });
  }

  const { name } = (await req.json()) as { name?: string };
  const trimmed = name?.trim();
  if (!trimmed) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });

  try {
    const updated = await prisma.assessmentPeriod.update({
      where: { id: params.periodId },
      data: { name: trimmed },
    });
    return NextResponse.json({ ok: true, period: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "This framework already has a period with that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}

/**
 * Removes a period — cascades its components (see schema.prisma:
 * AssessmentComponent.period onDelete: Cascade). Real DELETE route:
 * periods/components are current-state config, not historical, the
 * same non-audited classification as GradeSubject/TeacherAcademicAssignment
 * (see docs/PRODUCT_RULES.md).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; frameworkId: string; periodId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const period = await prisma.assessmentPeriod.findUnique({
    where: { id: params.periodId },
    include: { framework: true },
  });
  if (!period || period.frameworkId !== params.frameworkId || period.framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Period not found." }, { status: 404 });
  }

  await prisma.assessmentPeriod.delete({ where: { id: params.periodId } });
  return NextResponse.json({ ok: true });
}
