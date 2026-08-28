import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/authorize";
import { notify } from "@/lib/notify";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const adminId = await requirePlatformAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const school = await prisma.school.update({
    where: { id: params.id },
    data: { verified: true },
    include: { admins: true },
  });

  await Promise.all(
    school.admins.map((a) =>
      notify(
        a.userId,
        "SCHOOL_VERIFIED",
        `${school.name} is now verified!`,
        "Your school is live in the public directory, and staff/students can now find and join it."
      )
    )
  );

  return NextResponse.json({ ok: true, school });
}
