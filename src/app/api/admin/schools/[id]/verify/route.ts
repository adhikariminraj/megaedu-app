import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/authorize";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const adminId = await requirePlatformAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const school = await prisma.school.update({
    where: { id: params.id },
    data: { verified: true },
  });

  return NextResponse.json({ ok: true, school });
}
