import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

type GradeInput = { gradeReferenceId: string; displayName: string };

/**
 * Bulk upsert of a school's SchoolGrade rows — used by both the
 * "configure grades" and "display names" steps of Initial Setup (the
 * same shape, called twice: once with the GradeReference code as the
 * default displayName, once with the admin's edited labels). Additive
 * only — never deletes a SchoolGrade a school previously opted into,
 * even if it's omitted from a later call, since it may already have
 * TeacherGradeAssignment/GradeHistory rows depending on it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { grades } = (await req.json()) as { grades?: GradeInput[] };
  const valid = (grades || []).filter((g) => g.gradeReferenceId && g.displayName?.trim());
  if (valid.length === 0) {
    return NextResponse.json(
      { error: "Select at least one grade with a display name." },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    valid.map((g) =>
      prisma.schoolGrade.upsert({
        where: {
          schoolId_gradeReferenceId: { schoolId: params.id, gradeReferenceId: g.gradeReferenceId },
        },
        update: { displayName: g.displayName.trim() },
        create: {
          schoolId: params.id,
          gradeReferenceId: g.gradeReferenceId,
          displayName: g.displayName.trim(),
        },
      })
    )
  );

  return NextResponse.json({ ok: true, grades: results });
}
