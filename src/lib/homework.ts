import { prisma } from "@/lib/prisma";
import { sectionScopeWhere } from "@/lib/authorize";

/**
 * Today's calendar date in Asia/Kathmandu, as a "YYYY-MM-DD" string.
 * Deliberately NOT `new Date().toISOString().slice(0, 10)` — that
 * reflects the UTC calendar date, which diverges from Nepal's actual
 * local date for roughly the first ~5h45m of every Nepal day (NPT is
 * UTC+5:45), exactly the early-morning window a parent checking
 * "today's homework" before the school day starts is most likely to
 * hit. Hardcoded to this one timezone deliberately — this platform is
 * Nepal-only today, and no School has ever had (or needed) its own
 * timezone field; adding one now would be speculative infrastructure
 * for a scenario that doesn't exist yet.
 */
export function todayInKathmandu(): string {
  // en-CA's locale format is exactly YYYY-MM-DD, so no manual
  // reassembly of Intl's parts is needed.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date());
}

export type HomeworkRow = {
  id: string;
  subjectName: string;
  title: string;
  instructions: string;
  dueDate: string; // "YYYY-MM-DD"
};

/**
 * Today's PUBLISHED homework applicable to one student, resolved
 * entirely from that student's current institutional placement — never
 * a stored per-student row. Shared by the Student's own dashboard and,
 * once per linked child, the Parent dashboard — the same
 * "one function, every caller" discipline already established by
 * fetchAcademicProgress() (src/lib/academicProgress.ts), so the two
 * views can never drift apart. Callers are responsible for only ever
 * passing a studentId they've already verified the caller is allowed to
 * see — this function itself does no authorization, matching
 * fetchAcademicProgress()'s own documented contract.
 */
export async function fetchTodaysHomework(studentId: string): Promise<HomeworkRow[]> {
  const currentPlacement = await prisma.gradeHistory.findFirst({
    where: { studentId, academicSession: { status: "ACTIVE" } },
  });
  if (!currentPlacement) return [];

  const today = new Date(todayInKathmandu());

  const homework = await prisma.homework.findMany({
    where: {
      status: "PUBLISHED",
      academicSessionId: currentPlacement.academicSessionId,
      schoolGradeId: currentPlacement.schoolGradeId,
      dueDate: today,
      ...sectionScopeWhere(currentPlacement.sectionId),
    },
    include: { subject: true },
    orderBy: { subject: { name: "asc" } },
  });

  return homework.map((hw) => ({
    id: hw.id,
    subjectName: hw.subject.name,
    title: hw.title,
    instructions: hw.instructions,
    dueDate: hw.dueDate.toISOString().slice(0, 10),
  }));
}
