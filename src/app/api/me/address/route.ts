import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateAddressInput, isAddressError } from "@/lib/address";

const ALLOWED_LABELS = ["CURRENT", "PERMANENT"];

/**
 * Self-service Current/Permanent address for the logged-in MEGA ID.
 * Always writes to the session's own userId — never a client-supplied
 * one — so this route can only ever touch the caller's own address,
 * the same "no requireSelf helper needed, the session IS the scope"
 * shape as every other /api/me-style write in this app.
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const body = await req.json();
  const label = typeof body.label === "string" ? body.label : "";
  if (!ALLOWED_LABELS.includes(label)) {
    return NextResponse.json({ error: "Label must be CURRENT or PERMANENT." }, { status: 400 });
  }

  const validated = await validateAddressInput(body);
  if (isAddressError(validated)) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const address = await prisma.address.upsert({
    where: { userId_label: { userId, label } },
    update: { ...validated, updatedByUserId: userId },
    create: { ...validated, userId, label, updatedByUserId: userId },
    include: { province: true, district: true, localLevel: true },
  });

  return NextResponse.json({ ok: true, address });
}
