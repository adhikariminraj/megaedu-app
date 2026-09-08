import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import CompletionClient from "./CompletionClient";

export const dynamic = "force-dynamic";

/**
 * K2 — Homework Completion recording. Teacher-only, matching the K2
 * authorization decision: School Admin (and, by extension, Class
 * Teacher/Grade Coordinator — neither of which even reaches this page
 * today, since only Homework's own Teacher/Admin roles are wired up at
 * all) has no authority over individual Homework completion. An Admin
 * who reaches this URL is redirected back to the Homework list rather
 * than shown a form that would only ever 403 on submit — the actual,
 * scope-specific authorization (does THIS teacher hold a matching
 * TeacherAcademicAssignment for THIS homework) is re-verified fresh by
 * the API route itself (GET/POST .../completion), never assumed here.
 */
export default async function HomeworkCompletionPage({
  params,
}: {
  params: { schoolId: string; homeworkId: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const access = await verifySchoolAccess(userId, params.schoolId);
  if (!access || access.role !== "TEACHER") redirect(`/dashboard/schools/${params.schoolId}/homework`);

  const homework = await prisma.homework.findUnique({
    where: { id: params.homeworkId },
    include: { subject: true, schoolGrade: true, section: true, targetStudent: true },
  });
  if (!homework || homework.schoolGrade.schoolId !== params.schoolId) {
    redirect(`/dashboard/schools/${params.schoolId}/homework`);
  }
  if (homework.status !== "PUBLISHED") {
    redirect(`/dashboard/schools/${params.schoolId}/homework`);
  }

  return (
    <CompletionClient
      schoolId={params.schoolId}
      homeworkId={params.homeworkId}
      homework={{
        title: homework.title,
        subjectName: homework.subject.name,
        gradeDisplayName: homework.schoolGrade.displayName,
        sectionName: homework.section?.name ?? null,
        targetStudentName: homework.targetStudent?.fullName ?? null,
        dueDate: homework.dueDate.toISOString().slice(0, 10),
      }}
    />
  );
}
