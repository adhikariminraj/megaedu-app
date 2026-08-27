import { redirect, notFound } from "next/navigation";
import { requireCourseOwner } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";
import CourseManageClient from "./CourseManageClient";

export const dynamic = "force-dynamic";

export default async function ManageCoursePage({ params }: { params: { courseId: string } }) {
  const userId = await requireCourseOwner(params.courseId);
  if (!userId) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    include: { modules: { include: { lessons: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  });
  if (!course) notFound();

  return <CourseManageClient course={course} />;
}
