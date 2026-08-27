import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import EnrollButton from "./EnrollButton";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({ params }: { params: { slug: string } }) {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: {
      organization: true,
      approach: true,
      modules: { include: { lessons: true }, orderBy: { order: "asc" } },
    },
  });

  if (!course || !course.published) notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  let existingEnrollmentId: string | null = null;
  if (userId) {
    const [teacher, student] = await Promise.all([
      prisma.teacher.findUnique({ where: { userId } }),
      prisma.student.findUnique({ where: { userId } }),
    ]);
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: course.id,
        ...(teacher ? { teacherId: teacher.id } : student ? { studentId: student.id } : {}),
      },
    });
    existingEnrollmentId = enrollment?.id || null;
  }

  return (
    <div>
      <div className="bg-mega-navy text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-slate-300 text-sm mb-2">{course.organization?.name}</p>
          <h1 className="text-3xl md:text-4xl font-bold">{course.title}</h1>
          {course.description && (
            <p className="text-slate-300 mt-3 max-w-2xl">{course.description}</p>
          )}
          <div className="mt-6">
            <EnrollButton
              courseId={course.id}
              courseSlug={course.slug}
              isFree={course.priceCents === 0}
              loggedIn={!!userId}
              existingEnrollmentId={existingEnrollmentId}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Course Outline</h2>
        {course.modules.length === 0 ? (
          <p className="text-slate-400 text-sm">No modules added yet.</p>
        ) : (
          <div className="space-y-4">
            {course.modules.map((m, i) => (
              <div key={m.id} className="border border-slate-200 rounded-xl p-5">
                <p className="font-semibold text-slate-800">
                  Module {i + 1}: {m.title}
                </p>
                <ul className="mt-2 space-y-1">
                  {m.lessons.map((l) => (
                    <li key={l.id} className="text-sm text-slate-500">
                      · {l.title}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
