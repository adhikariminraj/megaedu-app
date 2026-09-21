import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";

export async function POST(req: NextRequest, { params }: { params: { courseId: string } }) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Module title is required." }, { status: 400 });
  }

  // max + 1 (not the row count) so an order never collides with an
  // existing module once modules can be deleted.
  const last = await prisma.courseModule.aggregate({ where: { courseId: params.courseId }, _max: { order: true } });
  const courseModule = await prisma.courseModule.create({
    data: { courseId: params.courseId, title, order: (last._max.order ?? -1) + 1 },
  });

  return NextResponse.json({ ok: true, module: courseModule });
}
