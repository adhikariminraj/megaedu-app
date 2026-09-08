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
 * AssessmentComponent.period onDelete: Cascade), which themselves
 * cascade to AssessmentComponentResult (see schema.prisma:
 * AssessmentComponentResult.component onDelete: Cascade). Periods/
 * components are current-state config, not historical, the same
 * non-audited classification as GradeSubject/TeacherAcademicAssignment
 * (see docs/PRODUCT_RULES.md) — but that classification stops being
 * true the moment a component under this period has recorded real
 * student results, exactly the same invariant the sibling component
 * DELETE route (components/[componentId]/route.ts) already enforces.
 * Blocked here for the identical reason: this period's own
 * onDelete: Cascade chain would otherwise silently destroy that result
 * history two levels down, bypassing the component route's own guard
 * entirely.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; frameworkId: string; periodId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$transaction(async (tx) => {
      const period = await tx.assessmentPeriod.findUnique({
        where: { id: params.periodId },
        include: { framework: true },
      });
      if (!period || period.frameworkId !== params.frameworkId || period.framework.schoolId !== params.id) {
        throw new PeriodRouteError(404, "Period not found.");
      }

      const hasResults = await tx.assessmentComponentResult.findFirst({
        where: { component: { periodId: params.periodId } },
      });
      if (hasResults) {
        throw new PeriodRouteError(
          409,
          "This period has components with results recorded against them and cannot be deleted."
        );
      }

      await tx.assessmentPeriod.delete({ where: { id: params.periodId } });
    });
  } catch (err) {
    if (err instanceof PeriodRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}

class PeriodRouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
