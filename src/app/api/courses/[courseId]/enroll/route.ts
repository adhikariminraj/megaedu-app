import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { courseId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: { organization: { select: { verified: true } } },
  });
  if (!course || !course.published) {
    return NextResponse.json({ error: "Course not available." }, { status: 404 });
  }
  // Belt-and-suspenders alongside the publish-time check in
  // /api/courses/[courseId]/route.ts — a course whose organization was
  // verified at publish time but has since been un-verified (no such
  // route exists today, but the check should not silently rely on that)
  // must not accept new enrollments either. Same "not available" wording
  // as the line above — from the enrolling learner's perspective this is
  // functionally identical to the course not being published.
  if (course.organization && !course.organization.verified) {
    return NextResponse.json({ error: "Course not available." }, { status: 404 });
  }
  if (course.priceCents > 0) {
    // Payment integration (eSewa/Khalti) isn't built yet — see README.
    return NextResponse.json(
      { error: "Paid course enrollment isn't available yet. This course is not free." },
      { status: 400 }
    );
  }

  // Academy Participation kilometer — userId (not Teacher/Student
  // status) is the enrollment's identity. teacherId/studentId are still
  // resolved and stored whenever the enrolling MEGA ID happens to also
  // hold that institutional profile — purely contextual enrichment for
  // TeacherDashboard/StudentDashboard's existing course lists, never a
  // requirement to enroll. A Parent, Organization Admin/Accountant, or
  // any other authenticated MEGA ID with neither profile enrolls with
  // both left null.
  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId } }),
    prisma.student.findUnique({ where: { userId } }),
  ]);

  const existing = await prisma.courseEnrollment.findFirst({
    where: { courseId: params.courseId, userId },
  });
  if (existing) {
    return NextResponse.json({ ok: true, enrollment: existing, alreadyEnrolled: true });
  }

  const enrollment = await prisma.courseEnrollment.create({
    data: {
      courseId: params.courseId,
      userId,
      teacherId: teacher?.id,
      studentId: student?.id,
    },
  });

  return NextResponse.json({ ok: true, enrollment });
}
