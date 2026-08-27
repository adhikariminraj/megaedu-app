import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";

export async function PATCH(req: NextRequest, { params }: { params: { courseId: string } }) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.published === "boolean") data.published = body.published;
  if (typeof body.priceCents === "number") data.priceCents = body.priceCents;

  const course = await prisma.course.update({ where: { id: params.courseId }, data });
  return NextResponse.json({ ok: true, course });
}
