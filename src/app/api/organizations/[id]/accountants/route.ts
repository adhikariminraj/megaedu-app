import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    return NextResponse.json(
      { error: "No MEGA ID found with that email. They need to register first." },
      { status: 404 }
    );
  }

  const existing = await prisma.organizationAccountant.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: params.id } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyGranted: true });

  await prisma.$transaction(async (tx) => {
    await tx.organizationAccountant.create({ data: { userId: user.id, organizationId: params.id } });
    const hasRole = await tx.userRole.findUnique({
      where: { userId_role: { userId: user.id, role: "ACCOUNTANT" } },
    });
    if (!hasRole) {
      await tx.userRole.create({ data: { userId: user.id, role: "ACCOUNTANT" } });
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountants = await prisma.organizationAccountant.findMany({
    where: { organizationId: params.id },
    include: { user: true },
  });
  return NextResponse.json({ accountants });
}
