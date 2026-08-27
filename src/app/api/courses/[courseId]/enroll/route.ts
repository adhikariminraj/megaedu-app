import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.courseId } });
  if (!course || !course.published) {
    return NextResponse.json({ error: "Course not available." }, { status: 404 });
  }
  if (course.priceCents > 0) {
    // Payment integration (eSewa/Khalti) isn't built yet — see README.
    return NextResponse.json(
      { error: "Paid course enrollment isn't available yet. This course is not free." },
      { status: 400 }
    );
  }

  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId } }),
    prisma.student.findUnique({ where: { userId } }),
  ]);

  if (!teacher && !student) {
    return NextResponse.json(
      { error: "Only teacher or student accounts can enroll in courses right now." },
      { status: 403 }
    );
  }

  const existing = await prisma.courseEnrollment.findFirst({
    where: {
      courseId: params.courseId,
      ...(teacher ? { teacherId: teacher.id } : { studentId: student!.id }),
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, enrollment: existing, alreadyEnrolled: true });
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId: params.courseId,
      teacherId: teacher?.id,
      studentId: student?.id,
    },
  });

  return NextResponse.json({ ok: true, enrollment });
}
