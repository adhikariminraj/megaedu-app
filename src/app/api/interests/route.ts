import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Interest name is required." }, { status: 400 });

  const existing = await prisma.interest.findUnique({
    where: { userId_name: { userId, name: name.trim() } },
  });
  if (existing) return NextResponse.json({ ok: true, interest: existing, alreadyExists: true });

  const interest = await prisma.interest.create({ data: { userId, name: name.trim() } });
  return NextResponse.json({ ok: true, interest });
}
