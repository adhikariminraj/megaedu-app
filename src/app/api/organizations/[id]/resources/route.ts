import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/authorize";

/**
 * Organization Resource creation — A7. First write path Resource has
 * ever had (School has none either). Mirrors the Opportunity/Course
 * creation shape — Organization-Admin-only, organizationId from the
 * URL, never accepted from the client body. fileUrl is preserved as a
 * plain string per the existing Resource model contract — no upload
 * infrastructure introduced here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireOrgAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, fileUrl, subject, gradeLevel, approachId } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const resource = await prisma.resource.create({
    data: {
      organizationId: params.id,
      title: title.trim(),
      description: description?.trim() || null,
      fileUrl: fileUrl?.trim() || null,
      subject: subject?.trim() || null,
      gradeLevel: gradeLevel?.trim() || null,
      approachId: approachId || null,
    },
  });

  return NextResponse.json({ ok: true, resource });
}
