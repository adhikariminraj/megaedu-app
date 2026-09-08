import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveApplicabilityAccess } from "@/lib/homeworkAuthorization";
import { createSubmissionAttempt, HomeworkSubmissionValidationError } from "@/lib/homeworkSubmission";
import { saveSubmissionFile, UploadValidationError } from "@/lib/uploads";

async function loadApplicabilityForAccess(applicabilityId: string) {
  const applicability = await prisma.homeworkApplicability.findUnique({
    where: { id: applicabilityId },
    include: { homework: { include: { schoolGrade: true } } },
  });
  if (!applicability) return null;
  return applicability;
}

/**
 * K3 — GET returns this applicability's full submission-attempt history
 * (never just the latest) to any of the three authorized roles (Student
 * owner, their Parent, the authorized Subject Teacher — see
 * resolveApplicabilityAccess()). File content itself is never returned
 * here — only a boolean "has a file" plus the attempt's own id, which
 * the client uses against the separate authenticated file route
 * (/api/homework-submissions/[attemptId]/file) so a raw storage path is
 * never exposed to the client at all.
 */
export async function GET(req: NextRequest, { params }: { params: { applicabilityId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applicability = await loadApplicabilityForAccess(params.applicabilityId);
  if (!applicability) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const access = await resolveApplicabilityAccess(userId, applicability, applicability.homework.schoolGrade.schoolId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attempts = await prisma.homeworkSubmissionAttempt.findMany({
    where: { homeworkApplicabilityId: params.applicabilityId },
    orderBy: { attemptNumber: "asc" },
  });

  return NextResponse.json({
    ok: true,
    attempts: attempts.map((a) => ({
      id: a.id,
      attemptNumber: a.attemptNumber,
      submittedAt: a.submittedAt.toISOString(),
      isLate: a.isLate,
      textContent: a.textContent,
      hasFile: !!a.filePath,
    })),
  });
}

/**
 * K3 — POST creates a new submission attempt. Student-only: the
 * session's own Student identity must equal this applicability's
 * studentId (resolveApplicabilityAccess() role "STUDENT") — never a
 * Parent "on behalf of," never a Teacher/Admin. multipart/form-data:
 * `text` (optional string) and `file` (optional image). At least one is
 * required (enforced in createSubmissionAttempt()). The file, if
 * present, is validated and saved via saveSubmissionFile() — private
 * storage, never a public URL — before the attempt row is created.
 */
export async function POST(req: NextRequest, { params }: { params: { applicabilityId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applicability = await loadApplicabilityForAccess(params.applicabilityId);
  if (!applicability) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const access = await resolveApplicabilityAccess(userId, applicability, applicability.homework.schoolGrade.schoolId);
  if (!access || access.role !== "STUDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const textValue = form.get("text");
  const fileValue = form.get("file");
  const textContent = typeof textValue === "string" && textValue.trim() ? textValue.trim() : null;

  let filePath: string | null = null;
  if (fileValue instanceof File && fileValue.size > 0) {
    try {
      filePath = await saveSubmissionFile(fileValue, "homework-submissions");
    } catch (err) {
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  try {
    const attempt = await createSubmissionAttempt({
      homeworkApplicabilityId: params.applicabilityId,
      submittedByUserId: userId,
      textContent,
      filePath,
    });
    return NextResponse.json({
      ok: true,
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt.toISOString(),
        isLate: attempt.isLate,
        textContent: attempt.textContent,
        hasFile: !!attempt.filePath,
      },
    });
  } catch (err) {
    if (err instanceof HomeworkSubmissionValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
