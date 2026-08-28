import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  // Any approved teacher at this school, or the school's admin, can view
  // its student roster — matches the interim rule that grade-scoping
  // isn't built yet (Phase 2).
  const [teacher, admin] = await Promise.all([
    prisma.teacher.findFirst({ where: { userId, schoolId: params.id, approved: true } }),
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: params.id } } }),
  ]);
  if (!teacher && !admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const students = await prisma.student.findMany({
    where: { schoolId: params.id, approved: true },
    include: { user: true, skills: { include: { addedBy: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ students });
}
