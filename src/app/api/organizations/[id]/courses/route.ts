import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, approachId, priceCents } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Course title is required." }, { status: 400 });
  }

  let slug = slugify(title);
  const taken = await prisma.course.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const course = await prisma.course.create({
    data: {
      organizationId: params.id,
      title,
      slug,
      description,
      approachId: approachId || null,
      priceCents: priceCents || 0,
      published: false,
    },
  });

  return NextResponse.json({ ok: true, course });
}
