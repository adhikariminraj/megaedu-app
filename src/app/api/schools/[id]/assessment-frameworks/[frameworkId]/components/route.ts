import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { ENTRY_MODES, componentCollisionExists } from "@/lib/assessmentFramework";

/**
 * Adds one AssessmentComponent to an existing framework, optionally
 * nested under one of its periods. A duplicate name is caught by an
 * explicit pre-check (componentCollisionExists) and returns 409; a
 * simultaneous duplicate is caught by the database — the @@unique inside
 * a period, the partial unique index
 * AssessmentComponent_unique_name_framework_level at framework level
 * (finding F2, rule A4) — and returns the same 409.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; frameworkId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const framework = await prisma.assessmentFramework.findUnique({ where: { id: params.frameworkId } });
  if (!framework || framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Framework not found." }, { status: 404 });
  }

  const { name, maxMarks, entryMode, periodId } = (await req.json()) as {
    name?: string;
    maxMarks?: number;
    entryMode?: string;
    periodId?: string | null;
  };
  const trimmedName = name?.trim();
  if (!trimmedName || typeof maxMarks !== "number" || maxMarks <= 0) {
    return NextResponse.json(
      { error: "A component name and a maxMarks greater than 0 are required." },
      { status: 400 }
    );
  }
  if (entryMode && !ENTRY_MODES.includes(entryMode as any)) {
    return NextResponse.json({ error: `Invalid entryMode: ${entryMode}` }, { status: 400 });
  }

  let resolvedPeriodId: string | null = null;
  if (periodId) {
    const period = await prisma.assessmentPeriod.findUnique({ where: { id: periodId } });
    if (!period || period.frameworkId !== params.frameworkId) {
      return NextResponse.json({ error: "Invalid period." }, { status: 400 });
    }
    resolvedPeriodId = periodId;
  }

  const nameTaken = NextResponse.json(
    { error: "A component with that name already exists in this scope." },
    { status: 409 }
  );
  if (
    await componentCollisionExists({
      frameworkId: params.frameworkId,
      periodId: resolvedPeriodId,
      name: trimmedName,
    })
  ) {
    return nameTaken;
  }

  const count = await prisma.assessmentComponent.count({
    where: { frameworkId: params.frameworkId, periodId: resolvedPeriodId },
  });

  try {
    const component = await prisma.assessmentComponent.create({
      data: {
        frameworkId: params.frameworkId,
        periodId: resolvedPeriodId,
        name: trimmedName,
        maxMarks,
        entryMode: entryMode || "MARKS",
        order: count,
      },
    });
    return NextResponse.json({ ok: true, component });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return nameTaken;
    throw err;
  }
}
