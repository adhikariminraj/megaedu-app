import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const interest = await prisma.interest.findUnique({ where: { id: params.id } });
  if (!interest || interest.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.interest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
