import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";
import { parseVideoUrl } from "@/lib/academyContent";

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

  const video = parseVideoUrl(videoUrl);
  if (!video.ok) return NextResponse.json({ error: video.error }, { status: 400 });

  // max + 1 (not the row count) so an order never collides with an
  // existing lesson once lessons can be deleted.
  const last = await prisma.lesson.aggregate({ where: { moduleId: params.moduleId }, _max: { order: true } });
  const lesson = await prisma.lesson.create({
    data: { moduleId: params.moduleId, title, content, videoUrl: video.value, order: (last._max.order ?? -1) + 1 },
  });

  return NextResponse.json({ ok: true, lesson });
}
