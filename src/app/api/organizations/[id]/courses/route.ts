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

  const { title, description, approachId, priceCents, instructorName } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Course title is required." }, { status: 400 });
  }

  let slug = slugify(title);
  const taken = await prisma.course.findUnique({ where: { slug } });
  if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  // A named instructor is optional. No MEGA ID is required to be an
  // instructor — the record can be linked to one later if they get one.
  // Phase 1 keeps this simple: a new Instructor row per course rather
  // than trying to guess whether a same-named person is the same
  // individual (name-based matching risks wrongly merging two different
  // people).
  let instructorId: string | undefined;
  if (instructorName?.trim()) {
    const instructor = await prisma.instructor.create({ data: { name: instructorName.trim() } });
    instructorId = instructor.id;
  }

  const course = await prisma.course.create({
    data: {
      organizationId: params.id,
      title,
      slug,
      description,
      approachId: approachId || null,
      priceCents: priceCents || 0,
      instructorId,
      published: false,
    },
  });

  return NextResponse.json({ ok: true, course });
}
