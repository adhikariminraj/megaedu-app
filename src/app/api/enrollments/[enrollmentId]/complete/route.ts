import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { enrollmentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { id: params.enrollmentId },
    include: { teacher: true, student: true, certificate: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Confirm this enrollment actually belongs to the logged-in user.
  const owns =
    (enrollment.teacher && enrollment.teacher.userId === userId) ||
    (enrollment.student && enrollment.student.userId === userId);
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (enrollment.certificate) {
    return NextResponse.json({ ok: true, alreadyCompleted: true, certificate: enrollment.certificate });
  }

  const [updated, certificate] = await prisma.$transaction([
    prisma.courseEnrollment.update({
      where: { id: params.enrollmentId },
      data: { progress: 100, completedAt: new Date() },
    }),
    prisma.certificate.create({
      data: {
        enrollmentId: params.enrollmentId,
        teacherId: enrollment.teacherId,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, enrollment: updated, certificate });
}
