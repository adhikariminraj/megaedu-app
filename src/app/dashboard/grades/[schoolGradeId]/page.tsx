import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PromotionRoster from "./PromotionRoster";

export const dynamic = "force-dynamic";

export default async function GradeRosterPage({
  params,
  searchParams,
}: {
  params: { schoolGradeId: string };
  searchParams: { session?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({
    where: { userId },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const schoolGrade = await prisma.schoolGrade.findUnique({
    where: { id: params.schoolGradeId },
    include: { gradeReference: true },
  });
  if (!schoolGrade || schoolGrade.schoolId !== schoolId) notFound();

  // Normally the current ACTIVE session — but the Pending/Unresolved
  // queue links here with ?session=<closed session id> so a School
  // Admin can go back and record the missing decision on an older,
  // now-closed session's roster. recordGradeDecision() itself doesn't
  // care about session status, so this works unchanged either way.
  const targetSession = searchParams.session
    ? await prisma.academicSession.findUnique({ where: { id: searchParams.session } })
    : await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });

  if (!targetSession || targetSession.schoolId !== schoolId) redirect("/dashboard/grades");

  const [roster, allSchoolGrades, gradeSections] = await Promise.all([
    prisma.gradeHistory.findMany({
      where: { schoolGradeId: params.schoolGradeId, academicSessionId: targetSession.id, status: "ENROLLED" },
      include: { student: { include: { user: true } }, section: true },
      orderBy: { student: { user: { name: "asc" } } },
    }),
    prisma.schoolGrade.findMany({
      where: { schoolId },
      include: { gradeReference: true },
      orderBy: { gradeReference: { order: "asc" } },
    }),
    prisma.section.findMany({
      where: { schoolGradeId: params.schoolGradeId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <PromotionRoster
      schoolId={schoolId}
      schoolGrade={{
        id: schoolGrade.id,
        displayName: schoolGrade.displayName,
        gradeReference: { code: schoolGrade.gradeReference.code, order: schoolGrade.gradeReference.order },
      }}
      academicSessionName={targetSession.name}
      isClosedSession={targetSession.status !== "ACTIVE"}
      roster={roster.map((r) => ({
        gradeHistoryId: r.id,
        studentId: r.studentId,
        studentName: r.student.user.name,
        sectionId: r.sectionId,
        sectionName: r.section?.name ?? null,
      }))}
      allSchoolGrades={allSchoolGrades.map((g) => ({
        id: g.id,
        displayName: g.displayName,
        gradeReference: { code: g.gradeReference.code, order: g.gradeReference.order },
      }))}
      sections={gradeSections.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
