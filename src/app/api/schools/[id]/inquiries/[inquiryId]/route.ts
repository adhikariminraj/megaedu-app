import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

const schema = z.object({
  status: z.enum(["NEW", "RESOLVED"]),
});

/**
 * School-Admin-only: update an inquiry's status (Phase 1 only ever
 * toggles NEW <-> RESOLVED — no assignment, no notes, no threading).
 * The inquiry's own schoolId is re-checked against the URL's :id, not
 * just the admin's access to that id — a cross-school inquiryId (e.g.
 * guessed or reused from another school's inbox) is rejected even
 * though the caller is a genuine School Admin, just not of this
 * inquiry's actual school.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; inquiryId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id: params.inquiryId } });
  if (!inquiry || inquiry.schoolId !== params.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.inquiry.update({
    where: { id: params.inquiryId },
    data: { status: parsed.data.status },
    // ipAddress is server-side only (rate-limiting) — never returned to
    // any client, per the field's own documented contract in schema.prisma.
    select: {
      id: true,
      schoolId: true,
      category: true,
      name: true,
      email: true,
      phone: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ ok: true, inquiry: updated });
}
