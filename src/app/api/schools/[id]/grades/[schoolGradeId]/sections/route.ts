import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { normalizeSectionName } from "@/lib/sections";

/**
 * Bulk-creates one or more Sections under a SchoolGrade — "A, B, C" in
 * one call, or one at a time. No fixed maximum. Additive only: never
 * deletes or deactivates an existing section, and re-submitting a name
 * that already exists for this grade is silently skipped (idempotent),
 * not an error.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; schoolGradeId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schoolGrade = await prisma.schoolGrade.findUnique({ where: { id: params.schoolGradeId } });
  if (!schoolGrade || schoolGrade.schoolId !== params.id) {
    return NextResponse.json({ error: "Grade not found." }, { status: 404 });
  }

  const { names } = (await req.json()) as { names?: string[] };
  const cleanNames = [...new Set((names || []).map((n) => normalizeSectionName(n)).filter(Boolean))];
  if (cleanNames.length === 0) {
    return NextResponse.json({ error: "Enter at least one section name." }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;
  const sections = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const name of cleanNames) {
      try {
        const section = await tx.section.create({
          data: { schoolGradeId: params.schoolGradeId, name },
        });
        out.push(section);
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // a section with this name already exists for this grade
          continue;
        }
        throw err;
      }
    }
    return out;
  });

  return NextResponse.json({ ok: true, sections, created, skipped });
}
