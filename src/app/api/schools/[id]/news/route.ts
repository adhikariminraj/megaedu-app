import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { notifySchoolCommunity } from "@/lib/notify";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body: newsBody } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const school = await prisma.school.findUnique({ where: { id: params.id }, select: { name: true } });

  const news = await prisma.newsPost.create({
    data: { schoolId: params.id, title, body: newsBody || "" },
  });

  // Fire-and-forget: notify approved staff/students, but don't let a
  // notification failure block the news post itself from succeeding.
  notifySchoolCommunity(params.id, `${school?.name || "Your school"}: ${title}`, newsBody);

  return NextResponse.json({ ok: true, news });
}
