import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Program name is required." }, { status: 400 });
  }

  const program = await prisma.program.create({
    data: { schoolId: params.id, name, description },
  });

  return NextResponse.json({ ok: true, program });
}
