import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { correctMarkSheet } from "@/lib/markSheet";

/**
 * Creates a corrected new Mark Sheet version, superseding the current
 * ISSUED one — School-Admin-only. The target markSheetId identifies
 * WHICH student/session to correct (its own studentId/academicSessionId
 * are read from that row, not the client) — this route does not require
 * the caller to already be looking at the current version; correcting
 * from any known version id resolves to the same (studentId,
 * academicSessionId) slot correctMarkSheet() operates on.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; markSheetId: string } }
) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.markSheet.findUnique({ where: { id: params.markSheetId } });
  if (!existing || existing.schoolId !== params.id) {
    return NextResponse.json({ error: "Mark Sheet not found." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { correctionReason?: string };
  if (!body.correctionReason?.trim()) {
    return NextResponse.json({ error: "A correction reason is required." }, { status: 400 });
  }

  const admin = await prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true } });

  const result = await correctMarkSheet({
    studentId: existing.studentId,
    schoolId: params.id,
    academicSessionId: existing.academicSessionId,
    issuedByUserId: adminUserId,
    issuerName: admin?.name ?? "School Admin",
    correctionReason: body.correctionReason,
  });

  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true, markSheet: result.markSheet });
}
