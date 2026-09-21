import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";

/**
 * Rename, move (up/down) or delete one CourseModule — course owner only
 * (requireCourseOwner). CourseModule is the Academy's section-level
 * structure. The module's own courseId is always re-verified against the
 * URL, so a module id from another course (or organization) is a 404.
 */
async function loadModule(courseId: string, moduleId: string) {
  const courseModule = await prisma.courseModule.findUnique({ where: { id: moduleId } });
  return courseModule && courseModule.courseId === courseId ? courseModule : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { courseId: string; moduleId: string } }
) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const courseModule = await loadModule(params.courseId, params.moduleId);
  if (!courseModule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  let title: string | undefined;
  if (body.title !== undefined) {
    title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Module title is required." }, { status: 400 });
  }
  const move = body.move;
  if (move !== undefined && move !== "up" && move !== "down") {
    return NextResponse.json({ error: "Move must be 'up' or 'down'." }, { status: 400 });
  }
  if (title === undefined && move === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  if (title !== undefined) {
    await prisma.courseModule.update({ where: { id: params.moduleId }, data: { title } });
  }

  if (move) {
    // Deterministic sibling order (order, then id) so an anomaly in
    // historical data can't make the swap ambiguous; every sibling is
    // then rewritten to 0..n-1 in one transaction.
    const siblings = await prisma.courseModule.findMany({
      where: { courseId: params.courseId },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const ids = siblings.map((s) => s.id);
    const index = ids.indexOf(params.moduleId);
    const target = move === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < ids.length) {
      [ids[index], ids[target]] = [ids[target], ids[index]];
    }
    await prisma.$transaction(
      ids.map((id, i) => prisma.courseModule.update({ where: { id }, data: { order: i } }))
    );
  }

  const updated = await prisma.courseModule.findUnique({ where: { id: params.moduleId } });
  return NextResponse.json({ ok: true, module: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { courseId: string; moduleId: string } }
) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const courseModule = await loadModule(params.courseId, params.moduleId);
  if (!courseModule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A published course must always keep at least one lesson: reject any
  // delete that would remove the last one. Drafts may go to zero. Never
  // auto-unpublishes.
  const course = await prisma.course.findUnique({ where: { id: params.courseId }, select: { published: true } });
  if (course?.published) {
    const remaining = await prisma.lesson.count({
      where: { module: { courseId: params.courseId }, moduleId: { not: params.moduleId } },
    });
    if (remaining === 0) {
      return NextResponse.json(
        { error: "A published course must keep at least one lesson. Unpublish it first, or add another lesson." },
        { status: 409 }
      );
    }
  }

  await prisma.courseModule.delete({ where: { id: params.moduleId } });
  return NextResponse.json({ ok: true });
}
