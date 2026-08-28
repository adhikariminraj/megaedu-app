import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const adminId = await requirePlatformAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organization = await prisma.organization.update({
    where: { id: params.id },
    data: { verified: true },
    include: { admins: true },
  });

  await Promise.all(
    organization.admins.map((a) =>
      notify(
        a.userId,
        "ORGANIZATION_VERIFIED",
        `${organization.name} is now verified!`,
        "You can now publish courses and post opportunities to the network."
      )
    )
  );

  return NextResponse.json({ ok: true, organization });
}
