import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type BandInput = {
  minPercent: number;
  maxPercent: number;
  label: string;
  gradePoint?: number | null;
  isPassing?: boolean | null;
  description?: string | null;
};

/**
 * Renames, activates/deactivates, and/or fully replaces the band set of
 * a GradingScale. There is deliberately no DELETE route — matching
 * Subject/Section/AssessmentFramework's precedent, a scale that may
 * already be referenced by a real AssessmentFramework is never
 * removable, only deactivated (isActive: false). Replacing `bands`
 * deletes the existing set and recreates it atomically — bands carry no
 * independent identity of their own yet, so a full-replace is simpler
 * and safer than diffing individual band edits.
 *
 * LOCKED once any PUBLISHED result exists using this scale (via any
 * framework it's attached to): the `bands` replacement is rejected
 * outright — a clear, consistent policy (locked or not, nothing in
 * between) rather than trying to distinguish "cosmetic" vs
 * "structural" band edits inside a full-replace architecture. A school
 * needing a materially different scale should create a new one and
 * assign it going forward; `name`/`isActive` remain editable at any
 * time (cosmetic, not structural).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; gradingScaleId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scale = await prisma.gradingScale.findUnique({ where: { id: params.gradingScaleId } });
  if (!scale || scale.schoolId !== params.id) {
    return NextResponse.json({ error: "Grading scale not found." }, { status: 404 });
  }

  const body = (await req.json()) as { name?: string; isActive?: boolean; bands?: BandInput[] };

  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    data.name = trimmed;
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (body.bands) {
    const frameworkIds = (
      await prisma.assessmentFramework.findMany({ where: { gradingScaleId: params.gradingScaleId }, select: { id: true } })
    ).map((f) => f.id);
    const assignmentIds = frameworkIds.length
      ? (
          await prisma.assessmentFrameworkAssignment.findMany({
            where: { frameworkId: { in: frameworkIds } },
            select: { id: true },
          })
        ).map((a) => a.id)
      : [];
    const hasPublishedResults =
      assignmentIds.length > 0 &&
      (await prisma.assessmentResultPublication.findFirst({
        where: { assignmentId: { in: assignmentIds }, status: "PUBLISHED" },
      }));
    if (hasPublishedResults) {
      return NextResponse.json(
        {
          error:
            "This grading scale's bands are locked — published results already exist using it. Create a new grading scale instead.",
        },
        { status: 409 }
      );
    }

    if (!body.bands.length) {
      return NextResponse.json({ error: "At least one band is required." }, { status: 400 });
    }
    for (const b of body.bands) {
      if (
        typeof b.minPercent !== "number" ||
        typeof b.maxPercent !== "number" ||
        b.minPercent < 0 ||
        b.maxPercent > 100 ||
        b.minPercent >= b.maxPercent ||
        !b.label?.trim()
      ) {
        return NextResponse.json(
          { error: "Each band needs a valid 0-100 min/max range (min < max) and a label." },
          { status: 400 }
        );
      }
    }
    const sorted = [...body.bands].sort((a, b) => a.minPercent - b.minPercent);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minPercent < sorted[i - 1].maxPercent) {
        return NextResponse.json({ error: "Bands must not overlap." }, { status: 400 });
      }
    }
  }

  if (Object.keys(data).length === 0 && !body.bands) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.gradingScale.update({ where: { id: params.gradingScaleId }, data });
      }
      if (body.bands) {
        await tx.gradingScaleBand.deleteMany({ where: { gradingScaleId: params.gradingScaleId } });
        await tx.gradingScaleBand.createMany({
          data: body.bands.map((b, i) => ({
            gradingScaleId: params.gradingScaleId,
            minPercent: b.minPercent,
            maxPercent: b.maxPercent,
            label: b.label.trim(),
            gradePoint: typeof b.gradePoint === "number" ? b.gradePoint : null,
            isPassing: typeof b.isPassing === "boolean" ? b.isPassing : null,
            description: b.description?.trim() || null,
            order: i,
          })),
        });
      }
      return tx.gradingScale.findUniqueOrThrow({
        where: { id: params.gradingScaleId },
        include: { bands: { orderBy: { order: "asc" } } },
      });
    });
    return NextResponse.json({ ok: true, scale: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Another grading scale already has that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
