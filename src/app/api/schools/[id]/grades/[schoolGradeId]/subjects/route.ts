import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Bulk-opts a grade into one or more Subjects — for ONE academic
 * session. Unlike Section, this is NOT reusable config: a new session
 * starts with zero GradeSubject rows for every grade until the School
 * Admin explicitly configures them here again, so a past session's
 * curriculum stays exactly as it was, unaffected by later changes.
 * Idempotent — re-submitting a subject already offered this session is
 * silently skipped, not an error.
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

  const { academicSessionId, subjectIds } = (await req.json()) as {
    academicSessionId?: string;
    subjectIds?: string[];
  };
  if (!academicSessionId || !subjectIds?.length) {
    return NextResponse.json(
      { error: "Select at least one subject to offer." },
      { status: 400 }
    );
  }

  const session = await prisma.academicSession.findUnique({ where: { id: academicSessionId } });
  if (!session || session.schoolId !== params.id) {
    return NextResponse.json({ error: "Invalid academic session." }, { status: 400 });
  }

  const validSubjectIds = await prisma.subject
    .findMany({ where: { schoolId: params.id, isActive: true }, select: { id: true } })
    .then((r) => new Set(r.map((s) => s.id)));

  const cleanIds = [...new Set(subjectIds)];

  let created = 0;
  let skipped = 0;
  const gradeSubjects = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const subjectId of cleanIds) {
      if (!validSubjectIds.has(subjectId)) {
        skipped++; // not a real, active subject at this school
        continue;
      }
      try {
        const gradeSubject = await tx.gradeSubject.create({
          data: { schoolGradeId: params.schoolGradeId, subjectId, academicSessionId },
        });
        out.push(gradeSubject);
        created++;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          skipped++; // already offered at this grade this session
          continue;
        }
        throw err;
      }
    }
    return out;
  });

  return NextResponse.json({ ok: true, gradeSubjects, created, skipped });
}
