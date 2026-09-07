import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { issueMarkSheet } from "@/lib/markSheet";

/**
 * Issues Version 1 of a student's annual Mark Sheet for the school's
 * current ACTIVE academic session — School-Admin-only. academicSessionId
 * is resolved server-side from the school's own ACTIVE session, never
 * accepted from the client, matching the product decision that Mark
 * Sheet V1 issues only against the currently-active session (issuing
 * against a closed/past session is deferred — see docs/MARK_SHEET.md).
 * issueMarkSheet() itself re-verifies every precondition (placement,
 * progression decision, publication completeness) — this route does no
 * validation of its own beyond authorization and resolving the session.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUserId = await requireSchoolAdmin(params.id);
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { studentId?: string };
  if (!body.studentId) return NextResponse.json({ error: "studentId is required." }, { status: 400 });

  const [admin, activeSession] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true } }),
    prisma.academicSession.findFirst({ where: { schoolId: params.id, status: "ACTIVE" } }),
  ]);
  if (!activeSession) {
    return NextResponse.json({ error: "This school has no active academic session." }, { status: 400 });
  }

  const result = await issueMarkSheet({
    studentId: body.studentId,
    schoolId: params.id,
    academicSessionId: activeSession.id,
    issuedByUserId: adminUserId,
    issuerName: admin?.name ?? "School Admin",
  });

  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true, markSheet: result.markSheet });
}
