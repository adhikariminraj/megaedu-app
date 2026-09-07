import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireClassTeacher } from "@/lib/authorize";
import { upsertCoScholasticResult } from "@/lib/coScholastic";
import { CURRENT_ROSTER_STATUSES } from "@/lib/gradeHistory";

/**
 * Bulk entry for one Co-Scholastic area, for one grade+session, at one
 * scope (a specific CoScholasticPeriod, or null for the annual entry).
 * Authorized to School Admin or any Class Teacher assigned to this
 * grade (grade-wide or section-specific — sectionId omitted means "is
 * this teacher assigned here at all," per sectionScopeWhere()'s own
 * documented semantics) — deliberately Class-Teacher-scoped, not
 * Subject-Teacher-scoped, matching the real-world evidence that
 * co-scholastic areas are a homeroom/class-wide responsibility, not a
 * per-subject one. Student-list scoping by section is not enforced in
 * this kilometer — any authorized Class Teacher for the grade may enter
 * for the whole grade's roster, a deliberate V1 simplification.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as {
    areaId?: string;
    schoolGradeId?: string;
    academicSessionId?: string;
    coScholasticPeriodId?: string | null;
    results?: { studentId: string; gradeLabel: string }[];
  };
  if (!body.areaId || !body.schoolGradeId || !body.academicSessionId || !body.results?.length) {
    return NextResponse.json({ error: "areaId, schoolGradeId, academicSessionId, and at least one result are required." }, { status: 400 });
  }

  const [adminUserId, teacherUserId] = await Promise.all([
    requireSchoolAdmin(params.id),
    requireClassTeacher(params.id, { academicSessionId: body.academicSessionId, schoolGradeId: body.schoolGradeId }),
  ]);
  const userId = adminUserId || teacherUserId;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const area = await prisma.coScholasticArea.findUnique({ where: { id: body.areaId } });
  if (!area || area.schoolId !== params.id) {
    return NextResponse.json({ error: "Area not found." }, { status: 404 });
  }

  if (body.coScholasticPeriodId) {
    const period = await prisma.coScholasticPeriod.findUnique({ where: { id: body.coScholasticPeriodId } });
    if (!period || period.schoolGradeId !== body.schoolGradeId || period.academicSessionId !== body.academicSessionId) {
      return NextResponse.json({ error: "Invalid period for this grade/session." }, { status: 400 });
    }
  }

  // Only students currently in this grade/session may receive a
  // result — the same roster boundary the scholastic entry route
  // already enforces.
  const roster = await prisma.gradeHistory.findMany({
    where: { academicSessionId: body.academicSessionId, schoolGradeId: body.schoolGradeId, status: { in: CURRENT_ROSTER_STATUSES } },
    select: { studentId: true },
  });
  const rosterIds = new Set(roster.map((r) => r.studentId));

  let updated = 0;
  let skipped = 0;
  for (const r of body.results) {
    if (!rosterIds.has(r.studentId) || !r.gradeLabel?.trim()) {
      skipped++;
      continue;
    }
    await upsertCoScholasticResult({
      studentId: r.studentId,
      areaId: body.areaId,
      academicSessionId: body.academicSessionId,
      coScholasticPeriodId: body.coScholasticPeriodId ?? null,
      gradeLabel: r.gradeLabel.trim(),
      evaluatedByUserId: userId,
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
