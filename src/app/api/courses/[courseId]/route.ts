import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCourseOwner } from "@/lib/authorize";

export async function PATCH(req: NextRequest, { params }: { params: { courseId: string } }) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title;
  if (typeof body.description === "string") data.description = body.description;
  if (typeof body.published === "boolean") data.published = body.published;
  if (typeof body.priceCents === "number") data.priceCents = body.priceCents;

  // Publishing (never unpublishing, never any other field edit) requires
  // the owning Organization to be Platform-Admin-verified — the rule
  // OrgDashboard.tsx has always told admins about, now actually
  // enforced. A course with no organization at all (schema allows
  // organizationId: null, though nothing today creates one that way) is
  // not subject to this check — there is no organization to verify.
  //
  // Organization Academy Participation kilometer — publishing ALSO now
  // requires the organization to have opted into academyParticipant.
  // verified and academyParticipant are two independent facts (see
  // Organization.academyParticipant's schema comment); both must be
  // true. A verified-but-not-participating organization is exactly as
  // blocked here as an unverified one.
  if (data.published === true) {
    const target = await prisma.course.findUnique({
      where: { id: params.courseId },
      include: { organization: { select: { verified: true, academyParticipant: true } } },
    });
    if (target?.organization && !target.organization.verified) {
      return NextResponse.json(
        { error: "This organization must be verified by a Platform Admin before publishing a course." },
        { status: 403 }
      );
    }
    if (target?.organization && !target.organization.academyParticipant) {
      return NextResponse.json(
        { error: "This organization must opt into MEGA Academy participation before publishing a course." },
        { status: 403 }
      );
    }
  }

  const updated = await prisma.course.update({ where: { id: params.courseId }, data });
  return NextResponse.json({ ok: true, course: updated });
}
