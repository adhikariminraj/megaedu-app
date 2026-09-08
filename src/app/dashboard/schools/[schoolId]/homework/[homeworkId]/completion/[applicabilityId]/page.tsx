import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import { resolveApplicabilityAccess } from "@/lib/homeworkAuthorization";
import StudentDetailClient from "./StudentDetailClient";

export const dynamic = "force-dynamic";

/**
 * K3/K4 — one student's full Submission + Review history for one
 * Homework, plus (K4) the Subject Teacher's feedback form. Reached from
 * the K2 completion page via a per-student link — deliberately a
 * SEPARATE page rather than folding this into the existing completion
 * list, so that page's own reviewed layout stays untouched (K2's
 * "extend minimally, don't redesign" instruction applies here too).
 * Teacher-only, reusing resolveApplicabilityAccess() — the identical
 * authorization the submissions/reviews API routes themselves enforce,
 * so this page can never show a state the API wouldn't also allow.
 */
export default async function HomeworkCompletionStudentDetailPage({
  params,
}: {
  params: { schoolId: string; homeworkId: string; applicabilityId: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access || access.role !== "TEACHER") redirect(`/dashboard/schools/${params.schoolId}/homework`);

  const applicability = await prisma.homeworkApplicability.findUnique({
    where: { id: params.applicabilityId },
    include: {
      student: { select: { fullName: true } },
      homework: { include: { schoolGrade: true, subject: true } },
    },
  });
  if (!applicability || applicability.homeworkId !== params.homeworkId || applicability.homework.schoolGrade.schoolId !== params.schoolId) {
    redirect(`/dashboard/schools/${params.schoolId}/homework`);
  }

  const applicabilityAccess = await resolveApplicabilityAccess(userId, applicability!, params.schoolId);
  if (!applicabilityAccess || applicabilityAccess.role !== "TEACHER") {
    redirect(`/dashboard/schools/${params.schoolId}/homework/${params.homeworkId}/completion`);
  }

  return (
    <StudentDetailClient
      schoolId={params.schoolId}
      homeworkId={params.homeworkId}
      applicabilityId={params.applicabilityId}
      studentName={applicability!.student.fullName}
      homeworkTitle={applicability!.homework.title}
      subjectName={applicability!.homework.subject.name}
    />
  );
}
