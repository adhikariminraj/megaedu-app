import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";
import { parseVideoUrl } from "@/lib/academyContent";

/**
 * Edit, move (up/down) or delete one Lesson — course owner only
 * (requireCourseOwner). The URL hierarchy is verified end to end: the
 * module must belong to the course and the lesson to the module, else 404.
 */
async function loadLesson(courseId: string, moduleId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
  if (!lesson || lesson.moduleId !== moduleId || lesson.module.courseId !== courseId) return null;
  return lesson;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string; moduleId: string; lessonId: string } }
) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lesson = await loadLesson(params.courseId, params.moduleId, params.lessonId);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: { title?: string; content?: string; videoUrl?: string | null } = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Lesson title is required." }, { status: 400 });
    data.title = title;
  }
  if (body.content !== undefined) {
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "Lesson content is required." }, { status: 400 });
    data.content = content;
  }
  if (body.videoUrl !== undefined) {
    const video = parseVideoUrl(body.videoUrl);
    if (!video.ok) return NextResponse.json({ error: video.error }, { status: 400 });
    data.videoUrl = video.value;
  }
  const move = body.move;
  if (move !== undefined && move !== "up" && move !== "down") {
    return NextResponse.json({ error: "Move must be 'up' or 'down'." }, { status: 400 });
  }
  if (Object.keys(data).length === 0 && move === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  if (Object.keys(data).length > 0) {
    await prisma.lesson.update({ where: { id: params.lessonId }, data });
  }

  if (move) {
    // Same deterministic sibling normalization as module moves.
    const siblings = await prisma.lesson.findMany({
      where: { moduleId: params.moduleId },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const ids = siblings.map((s) => s.id);
    const index = ids.indexOf(params.lessonId);
    const target = move === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < ids.length) {
      [ids[index], ids[target]] = [ids[target], ids[index]];
    }
    await prisma.$transaction(ids.map((id, i) => prisma.lesson.update({ where: { id }, data: { order: i } })));
  }

  const updated = await prisma.lesson.findUnique({ where: { id: params.lessonId } });
  return NextResponse.json({ ok: true, lesson: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { courseId: string; moduleId: string; lessonId: string } }
) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lesson = await loadLesson(params.courseId, params.moduleId, params.lessonId);
  if (!lesson) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A published course must always keep at least one lesson. Drafts may
  // go to zero. Never auto-unpublishes.
  const course = await prisma.course.findUnique({ where: { id: params.courseId }, select: { published: true } });
  if (course?.published) {
    const remaining = await prisma.lesson.count({
      where: { module: { courseId: params.courseId }, id: { not: params.lessonId } },
    });
    if (remaining === 0) {
      return NextResponse.json(
        { error: "A published course must keep at least one lesson. Unpublish it first, or add another lesson." },
        { status: 409 }
      );
    }
  }

  await prisma.lesson.delete({ where: { id: params.lessonId } });
  return NextResponse.json({ ok: true });
}
