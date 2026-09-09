import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Edit or remove one NewsPost — School Admin only. Like Program, no
 * other model references a NewsPost row (confirmed — no reverse
 * relations anywhere in the schema), so a real DELETE is safe: nothing
 * can be orphaned. Editing/removing a news post never re-fires
 * notifySchoolCommunity() — that only ever happens once, at original
 * creation (POST .../news), matching the existing "notify on the
 * original action only" convention this codebase already uses
 * elsewhere.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; newsId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const news = await prisma.newsPost.findUnique({ where: { id: params.newsId } });
  if (!news || news.schoolId !== params.id) {
    return NextResponse.json({ error: "News post not found." }, { status: 404 });
  }

  const body = (await req.json()) as { title?: string; body?: string };
  const data: { title?: string; body?: string } = {};
  if (typeof body.title === "string") {
    const trimmed = body.title.trim();
    if (!trimmed) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    data.title = trimmed;
  }
  if (typeof body.body === "string") data.body = body.body;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const updated = await prisma.newsPost.update({ where: { id: params.newsId }, data });
  return NextResponse.json({ ok: true, news: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; newsId: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const news = await prisma.newsPost.findUnique({ where: { id: params.newsId } });
  if (!news || news.schoolId !== params.id) {
    return NextResponse.json({ error: "News post not found." }, { status: 404 });
  }

  await prisma.newsPost.delete({ where: { id: params.newsId } });
  return NextResponse.json({ ok: true });
}
