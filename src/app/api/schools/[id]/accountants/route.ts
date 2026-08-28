import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Grants Accountant finance access for this school to an EXISTING MEGA ID
 * user, identified by email. Deliberately admin-granted, not
 * self-registered — an Accountant is normally appointed/hired, not
 * someone who walks in and claims the role themselves.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
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

  const existing = await prisma.schoolAccountant.findUnique({
    where: { userId_schoolId: { userId: user.id, schoolId: params.id } },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyGranted: true });

  await prisma.$transaction(async (tx) => {
    await tx.schoolAccountant.create({ data: { userId: user.id, schoolId: params.id } });
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
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accountants = await prisma.schoolAccountant.findMany({
    where: { schoolId: params.id },
    include: { user: true },
  });
  return NextResponse.json({ accountants });
}
