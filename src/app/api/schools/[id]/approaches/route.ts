import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Links this school to an existing, platform-wide EducationalApproach —
 * School Admin only. SchoolApproach is many-to-many
 * (@@unique([schoolId, approachId]), no cardinality limit otherwise), so
 * a school may hold any number of these simultaneously; this route only
 * ever ADDS one link, never replaces the set — removing one is a
 * separate DELETE on .../approaches/[approachId].
 *
 * Deliberately never creates a new EducationalApproach — the School
 * Admin selects from the existing catalog only (nothing in this
 * codebase creates EducationalApproach records outside the seed
 * script; this route must not become the first such path). Upsert
 * makes re-adding an already-linked approach a safe no-op, matching
 * this codebase's general idempotent-POST convention (e.g. course
 * enrollment's alreadyEnrolled behavior).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { approachId } = (await req.json()) as { approachId?: string };
  if (!approachId) {
    return NextResponse.json({ error: "Select an educational approach." }, { status: 400 });
  }

  const approach = await prisma.educationalApproach.findUnique({ where: { id: approachId } });
  if (!approach) {
    return NextResponse.json({ error: "That educational approach doesn't exist." }, { status: 404 });
  }

  const link = await prisma.schoolApproach.upsert({
    where: { schoolId_approachId: { schoolId: params.id, approachId } },
    update: {},
    create: { schoolId: params.id, approachId },
  });

  return NextResponse.json({ ok: true, link });
}
