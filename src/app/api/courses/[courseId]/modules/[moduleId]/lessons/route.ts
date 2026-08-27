import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";

export async function POST(
  req: NextRequest,
  { params }: { params: { courseId: string; moduleId: string } }
) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const courseModule = await prisma.courseModule.findUnique({ where: { id: params.moduleId } });
  if (!courseModule || courseModule.courseId !== params.courseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { title, content, videoUrl } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
  }

  const count = await prisma.lesson.count({ where: { moduleId: params.moduleId } });
  const lesson = await prisma.lesson.create({
    data: { moduleId: params.moduleId, title, content, videoUrl, order: count },
  });

  return NextResponse.json({ ok: true, lesson });
}
