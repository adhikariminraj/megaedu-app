import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveApplicabilityAccess } from "@/lib/homeworkAuthorization";
import { readSubmissionFile } from "@/lib/uploads";

const EXT_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/**
 * K3 — the ONLY way a Homework Submission's file evidence is ever
 * served. Deliberately NOT a static /uploads/ URL — see
 * saveSubmissionFile() (src/lib/uploads.ts) for why: a student's
 * homework photo must never be reachable merely by obtaining its URL.
 * Re-verifies the requesting session's authorization to the attempt's
 * OWN HomeworkApplicability (Student owner, their Parent, or the
 * authorized Subject Teacher — resolveApplicabilityAccess(), the exact
 * same three-role check the submissions list/create route uses) fresh,
 * on every single request — no caching, no signed-URL shortcut that
 * could outlive a change in who's authorized.
 */
export async function GET(req: NextRequest, { params }: { params: { attemptId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attempt = await prisma.homeworkSubmissionAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      homeworkApplicability: { include: { homework: { include: { schoolGrade: true } } } },
    },
  });
  if (!attempt || !attempt.filePath) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const access = await resolveApplicabilityAccess(
    userId,
    attempt.homeworkApplicability,
    attempt.homeworkApplicability.homework.schoolGrade.schoolId
  );
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { buffer, ext } = await readSubmissionFile(attempt.filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": EXT_MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
