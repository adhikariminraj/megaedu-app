import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isTransactionConflict } from "@/lib/dbErrors";
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

  // Subjects already offered (@@unique([schoolGradeId, subjectId,
  // academicSessionId])) are pre-checked inside the transaction, never
  // caught mid-transaction: on PostgreSQL one failed statement aborts the
  // whole transaction. cleanIds is already de-duplicated. A P2002 can now
  // only mean a concurrent request offered the same subject first — the
  // batch rolls back with a 409.
  let created = 0;
  let skipped = 0;
  let gradeSubjects;
  try {
    gradeSubjects = await prisma.$transaction(async (tx) => {
      const offered = await tx.gradeSubject
        .findMany({
          where: { schoolGradeId: params.schoolGradeId, academicSessionId, subjectId: { in: cleanIds } },
          select: { subjectId: true },
        })
        .then((rows) => new Set(rows.map((row) => row.subjectId)));
      const out = [];
      for (const subjectId of cleanIds) {
        if (!validSubjectIds.has(subjectId)) {
          skipped++; // not a real, active subject at this school
          continue;
        }
        if (offered.has(subjectId)) {
          skipped++; // already offered at this grade this session
          continue;
        }
        const gradeSubject = await tx.gradeSubject.create({
          data: { schoolGradeId: params.schoolGradeId, subjectId, academicSessionId },
        });
        out.push(gradeSubject);
        created++;
      }
      return out;
    });
  } catch (err) {
    // A deadlock or serialization failure (finding F3) also rolled the whole batch back: same 409, retry is safe.
    if ((err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || isTransactionConflict(err)) {
      return NextResponse.json(
        { error: "These subjects were just changed by someone else — please refresh and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, gradeSubjects, created, skipped });
}
