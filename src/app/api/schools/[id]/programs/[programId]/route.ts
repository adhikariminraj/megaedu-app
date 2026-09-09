import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Edit or remove one Program — School Admin only. Unlike Section/
 * Subject/Event, no other model references a Program row (confirmed —
 * `Program` has no reverse relations anywhere in the schema), so a real
 * DELETE is safe here: nothing can be orphaned, and a Program is
 * current-state public-profile content, not a historical record. This
 * does deviate from this codebase's usual soft-deactivate convention
 * for School-authored content — see the audit report for why that
 * convention (which would need a new `isActive` column) was judged out
 * of scope for this bounded fix.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; programId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const program = await prisma.program.findUnique({ where: { id: params.programId } });
  if (!program || program.schoolId !== params.id) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  const body = (await req.json()) as { name?: string; description?: string };
  const data: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Program name is required." }, { status: 400 });
    data.name = trimmed;
  }
  if (typeof body.description === "string") data.description = body.description.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.program.update({ where: { id: params.programId }, data });
  return NextResponse.json({ ok: true, program: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; programId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const program = await prisma.program.findUnique({ where: { id: params.programId } });
  if (!program || program.schoolId !== params.id) {
    return NextResponse.json({ error: "Program not found." }, { status: 404 });
  }

  await prisma.program.delete({ where: { id: params.programId } });
  return NextResponse.json({ ok: true });
}
