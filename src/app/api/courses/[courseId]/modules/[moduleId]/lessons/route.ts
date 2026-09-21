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

  // videoUrl is optional, but when present it must be an http(s) URL —
  // rendered to enrolled learners as a link, so any other scheme
  // (javascript:, data:, ...) is rejected server-side.
  let safeVideoUrl: string | null = null;
  if (videoUrl !== undefined && videoUrl !== null && videoUrl !== "") {
    if (typeof videoUrl !== "string") {
      return NextResponse.json({ error: "Video link must be an http or https URL." }, { status: 400 });
    }
    const trimmedUrl = videoUrl.trim();
    let protocol: string | null = null;
    try {
      protocol = new URL(trimmedUrl).protocol;
    } catch {
      protocol = null;
    }
    if (trimmedUrl && protocol !== "http:" && protocol !== "https:") {
      return NextResponse.json({ error: "Video link must be an http or https URL." }, { status: 400 });
    }
    safeVideoUrl = trimmedUrl || null;
  }

  const count = await prisma.lesson.count({ where: { moduleId: params.moduleId } });
  const lesson = await prisma.lesson.create({
    data: { moduleId: params.moduleId, title, content, videoUrl: safeVideoUrl, order: count },
  });

  return NextResponse.json({ ok: true, lesson });
}
