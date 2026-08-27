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

  const count = await prisma.courseModule.count({ where: { courseId: params.courseId } });
  const courseModule = await prisma.courseModule.create({
    data: { courseId: params.courseId, title, order: count },
  });

  return NextResponse.json({ ok: true, module: courseModule });
}
