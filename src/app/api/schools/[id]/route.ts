import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { description, contactEmail, contactPhone, location, gradesOffered } = body;

  const school = await prisma.school.update({
    where: { id: params.id },
    data: { description, contactEmail, contactPhone, location, gradesOffered },
  });

  return NextResponse.json({ ok: true, school });
}
