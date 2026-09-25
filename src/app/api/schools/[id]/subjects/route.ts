import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Bulk-creates one or more Subjects in the school's catalog — "Math,
 * Science, English" in one call, or one at a time. School-wide, not
 * scoped to any grade or session (a grade opts into a subject via
 * GradeSubject). Additive only: re-submitting a name that already
 * exists is silently skipped (idempotent), not an error.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { names } = (await req.json()) as { names?: string[] };
  const cleanNames = [...new Set((names || []).map((n) => n.trim()).filter(Boolean))];
  if (cleanNames.length === 0) {
    return NextResponse.json({ error: "Enter at least one subject name." }, { status: 400 });
  }

  // Existing names (@@unique([schoolId, name])) are pre-checked inside the
  // transaction, never caught mid-transaction: on PostgreSQL one failed
  // statement aborts the whole transaction. cleanNames is already
  // de-duplicated. A P2002 can now only mean a concurrent request created
  // the same subject first — the batch rolls back with a 409.
  let created = 0;
  let skipped = 0;
  let subjects;
  try {
    subjects = await prisma.$transaction(async (tx) => {
      const existingNames = await tx.subject
        .findMany({ where: { schoolId: params.id, name: { in: cleanNames } }, select: { name: true } })
        .then((rows) => new Set(rows.map((row) => row.name)));
      const out = [];
      for (const name of cleanNames) {
        if (existingNames.has(name)) {
          skipped++; // a subject with this name already exists at this school
          continue;
        }
        const subject = await tx.subject.create({
          data: { schoolId: params.id, name },
        });
        out.push(subject);
        created++;
      }
      return out;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "One of these subjects was just added by someone else — please refresh and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true, subjects, created, skipped });
}
