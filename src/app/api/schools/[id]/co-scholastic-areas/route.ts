import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * The school-wide Co-Scholastic area catalog — School-Admin-only,
 * reusable across sessions (mirrors Subject's own lifecycle, never
 * session-scoped itself). Deliberately no gradingScaleId here — see
 * CoScholasticGradeSetting for where the scale actually lives.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const areas = await prisma.coScholasticArea.findMany({
    where: { schoolId: params.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ areas });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "name is required." }, { status: 400 });

  const existing = await prisma.coScholasticArea.findUnique({
    where: { schoolId_name: { schoolId: params.id, name: body.name.trim() } },
  });
  if (existing) return NextResponse.json({ error: "An area with this name already exists." }, { status: 409 });

  const count = await prisma.coScholasticArea.count({ where: { schoolId: params.id } });
  const area = await prisma.coScholasticArea.create({
    data: { schoolId: params.id, name: body.name.trim(), order: count },
  });
  return NextResponse.json({ ok: true, area });
}
