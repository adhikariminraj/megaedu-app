import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Reads and writes one grade+session's Co-Scholastic configuration —
 * which periods it uses (if any) and which GradingScale governs it.
 * School-Admin-only. Additive only: this route never removes an
 * existing CoScholasticPeriod, even if a later call omits its name —
 * matching this schema's established "never destructively drop
 * structural config once real data may reference it" precedent
 * (Section/Subject/GradingScale are deactivate-only, never deleted).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schoolGradeId = req.nextUrl.searchParams.get("schoolGradeId");
  const academicSessionId = req.nextUrl.searchParams.get("academicSessionId");
  if (!schoolGradeId || !academicSessionId) {
    return NextResponse.json({ error: "schoolGradeId and academicSessionId are required." }, { status: 400 });
  }

  const [periods, setting] = await Promise.all([
    prisma.coScholasticPeriod.findMany({ where: { schoolGradeId, academicSessionId }, orderBy: { order: "asc" } }),
    prisma.coScholasticGradeSetting.findUnique({
      where: { schoolGradeId_academicSessionId: { schoolGradeId, academicSessionId } },
      include: { gradingScale: true },
    }),
  ]);
  return NextResponse.json({ periods, gradingScale: setting?.gradingScale ?? null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    schoolGradeId?: string;
    academicSessionId?: string;
    periodNames?: string[];
    gradingScaleId?: string;
  };
  if (!body.schoolGradeId || !body.academicSessionId || !body.gradingScaleId) {
    return NextResponse.json({ error: "schoolGradeId, academicSessionId, and gradingScaleId are required." }, { status: 400 });
  }

  const [schoolGrade, gradingScale] = await Promise.all([
    prisma.schoolGrade.findUnique({ where: { id: body.schoolGradeId } }),
    prisma.gradingScale.findUnique({ where: { id: body.gradingScaleId } }),
  ]);
  if (!schoolGrade || schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Grade not found." }, { status: 404 });
  }
  if (!gradingScale || gradingScale.schoolId !== params.id) {
    return NextResponse.json({ error: "Grading scale not found." }, { status: 404 });
  }

  await prisma.coScholasticGradeSetting.upsert({
    where: { schoolGradeId_academicSessionId: { schoolGradeId: body.schoolGradeId, academicSessionId: body.academicSessionId } },
    create: {
      schoolId: params.id,
      schoolGradeId: body.schoolGradeId,
      academicSessionId: body.academicSessionId,
      gradingScaleId: body.gradingScaleId,
    },
    update: { gradingScaleId: body.gradingScaleId },
  });

  const existingPeriods = await prisma.coScholasticPeriod.findMany({
    where: { schoolGradeId: body.schoolGradeId, academicSessionId: body.academicSessionId },
  });
  const existingNames = new Set(existingPeriods.map((p) => p.name));
  const namesToAdd = (body.periodNames ?? []).map((n) => n.trim()).filter((n) => n && !existingNames.has(n));

  let order = existingPeriods.length;
  for (const name of namesToAdd) {
    await prisma.coScholasticPeriod.create({
      data: { schoolGradeId: body.schoolGradeId, academicSessionId: body.academicSessionId, name, order: order++ },
    });
  }

  return NextResponse.json({ ok: true });
}
