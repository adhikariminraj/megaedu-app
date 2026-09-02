import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifySessionForRollover } from "@/lib/gradeRollover";
import NewSessionForm from "./NewSessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const schoolAdmin = await prisma.schoolAdmin.findFirst({
    where: { userId },
    include: { school: true },
  });
  if (!schoolAdmin) redirect("/dashboard");
  const schoolId = schoolAdmin.school.id;

  const priorSession = await prisma.academicSession.findFirst({ where: { schoolId, status: "ACTIVE" } });
  if (!priorSession) redirect("/dashboard/setup");

  const { carryForward, leftOrTransferred, pending } = await classifySessionForRollover(
    schoolId,
    priorSession.id
  );

  return (
    <NewSessionForm
      schoolId={schoolId}
      schoolName={schoolAdmin.school.name}
      priorSessionName={priorSession.name}
      carryForward={carryForward.map((r) => ({
        studentName: r.student.fullName,
        fromGrade: r.schoolGrade.displayName,
        toGrade: r.outcomeGrade!.displayName,
        decision: r.status,
      }))}
      leftOrTransferred={leftOrTransferred.map((r) => ({
        studentName: r.student.fullName,
        fromGrade: r.schoolGrade.displayName,
        decision: r.status,
      }))}
      pending={pending.map((r) => ({
        studentName: r.student.fullName,
        fromGrade: r.schoolGrade.displayName,
      }))}
    />
  );
}
