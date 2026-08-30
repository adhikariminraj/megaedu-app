import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { ENTRY_MODES } from "@/lib/assessmentFramework";

type ComponentInput = {
  name: string;
  maxMarks: number;
  entryMode?: string;
  periodName?: string | null; // matched against `periods` below by name
};
type FrameworkInput = {
  name: string;
  description?: string | null;
  gradingScaleId?: string | null;
  periods?: string[]; // ordered period names, e.g. ["Term I", "Term II"]
  components?: ComponentInput[];
};

/**
 * Creates an AssessmentFramework — a reusable, school-wide marking-
 * scheme template (see schema.prisma comment block) — optionally with
 * its periods and components nested in the same request, so a School
 * Admin can define a complete framework (e.g. "40% CA + 60% Final
 * Exam", or a full Term I/Term II structure) in one call rather than a
 * create-then-many-follow-ups sequence. Periods/components can also be
 * added later via the dedicated sub-routes.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as FrameworkInput;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "A framework name is required." }, { status: 400 });
  }

  if (body.gradingScaleId) {
    const scale = await prisma.gradingScale.findUnique({ where: { id: body.gradingScaleId } });
    if (!scale || scale.schoolId !== params.id) {
      return NextResponse.json({ error: "Invalid grading scale." }, { status: 400 });
    }
  }

  const components = body.components || [];
  for (const c of components) {
    if (!c.name?.trim() || typeof c.maxMarks !== "number" || c.maxMarks <= 0) {
      return NextResponse.json(
        { error: "Each component needs a name and a maxMarks greater than 0." },
        { status: 400 }
      );
    }
    if (c.entryMode && !ENTRY_MODES.includes(c.entryMode as any)) {
      return NextResponse.json({ error: `Invalid entryMode: ${c.entryMode}` }, { status: 400 });
    }
  }

  const periodNames = [...new Set((body.periods || []).map((p) => p.trim()).filter(Boolean))];
  // Every component naming a periodName must match one of the declared periods.
  for (const c of components) {
    if (c.periodName && !periodNames.includes(c.periodName.trim())) {
      return NextResponse.json(
        { error: `Component "${c.name}" references an undeclared period "${c.periodName}".` },
        { status: 400 }
      );
    }
  }

  // Duplicate-name pre-check within the request itself, for both the
  // per-period and the framework-level (periodId: null) case — the
  // NULL≠NULL gap applies here too, so a plain in-memory check on the
  // submitted payload stands in for the DB-level check that would
  // otherwise miss two framework-level components sharing a name.
  const seen = new Set<string>();
  for (const c of components) {
    const key = `${c.periodName?.trim() || ""}::${c.name.trim()}`;
    if (seen.has(key)) {
      return NextResponse.json(
        { error: `Duplicate component name "${c.name}" within the same period.` },
        { status: 400 }
      );
    }
    seen.add(key);
  }

  try {
    const framework = await prisma.$transaction(async (tx) => {
      const created = await tx.assessmentFramework.create({
        data: {
          schoolId: params.id,
          name,
          description: body.description?.trim() || null,
          gradingScaleId: body.gradingScaleId || null,
        },
      });

      const periodIdByName = new Map<string, string>();
      for (let i = 0; i < periodNames.length; i++) {
        const period = await tx.assessmentPeriod.create({
          data: { frameworkId: created.id, name: periodNames[i], order: i },
        });
        periodIdByName.set(periodNames[i], period.id);
      }

      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        await tx.assessmentComponent.create({
          data: {
            frameworkId: created.id,
            periodId: c.periodName ? periodIdByName.get(c.periodName.trim())! : null,
            name: c.name.trim(),
            maxMarks: c.maxMarks,
            entryMode: c.entryMode || "MARKS",
            order: i,
          },
        });
      }

      return tx.assessmentFramework.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          periods: { orderBy: { order: "asc" } },
          components: { orderBy: { order: "asc" } },
          gradingScale: { include: { bands: { orderBy: { order: "asc" } } } },
        },
      });
    });
    return NextResponse.json({ ok: true, framework });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A framework with that name already exists at this school." },
        { status: 409 }
      );
    }
    throw err;
  }
}
