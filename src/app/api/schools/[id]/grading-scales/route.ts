import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type BandInput = {
  minPercent: number;
  maxPercent: number;
  label: string;
  gradePoint?: number | null;
  description?: string | null;
};

/**
 * Creates a GradingScale with its bands in one request — reusable,
 * school-wide, not scoped to any grade or session (an AssessmentFramework
 * opts into a scale via its own gradingScaleId, the same relationship
 * shape as Subject/GradeSubject). Bands are nested under the scale, not
 * independently creatable — a scale with zero bands is rejected, since
 * an empty scale can never classify anything.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, bands } = (await req.json()) as { name?: string; bands?: BandInput[] };
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return NextResponse.json({ error: "A grading scale name is required." }, { status: 400 });
  }
  if (!bands?.length) {
    return NextResponse.json({ error: "At least one band is required." }, { status: 400 });
  }

  for (const b of bands) {
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
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPercent < sorted[i - 1].maxPercent) {
      return NextResponse.json({ error: "Bands must not overlap." }, { status: 400 });
    }
  }

  try {
    const scale = await prisma.gradingScale.create({
      data: {
        schoolId: params.id,
        name: trimmedName,
        bands: {
          create: bands.map((b, i) => ({
            minPercent: b.minPercent,
            maxPercent: b.maxPercent,
            label: b.label.trim(),
            gradePoint: typeof b.gradePoint === "number" ? b.gradePoint : null,
            description: b.description?.trim() || null,
            order: i,
          })),
        },
      },
      include: { bands: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json({ ok: true, scale });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A grading scale with that name already exists at this school." },
        { status: 409 }
      );
    }
    throw err;
  }
}
