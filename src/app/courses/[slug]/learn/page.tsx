import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import CompleteButton from "./CompleteButton";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: { modules: { include: { lessons: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
  });
  if (!course) notFound();

  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({ where: { userId } }),
    prisma.student.findUnique({ where: { userId } }),
  ]);

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: {
      courseId: course.id,
      ...(teacher ? { teacherId: teacher.id } : student ? { studentId: student.id } : {}),
    },
    include: { certificate: true },
  });

  if (!enrollment) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Not enrolled</h1>
        <p className="text-slate-500">
          You need to enroll in this course before you can access its lessons.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{course.title}</h1>
      {enrollment.certificate ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block mb-8">
          ✓ Completed — certificate issued (code:{" "}
          <a href={`/verify/${enrollment.certificate.verificationCode}`} className="underline">
            {enrollment.certificate.verificationCode.slice(0, 8)}...
          </a>
          )
        </p>
      ) : (
        <p className="text-slate-500 mb-8">Work through each module below, then mark the course complete.</p>
      )}

      <div className="space-y-8">
        {course.modules.map((m, i) => (
          <div key={m.id}>
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Module {i + 1}: {m.title}
            </h2>
            <div className="space-y-4">
              {m.lessons.map((l) => (
                <div key={l.id} className="border border-slate-200 rounded-xl p-5">
                  <h3 className="font-medium text-slate-800 mb-2">{l.title}</h3>
                  {l.videoUrl && (
                    <a
                      href={l.videoUrl}
                      target="_blank"
                      className="text-sm text-mega-blue mb-2 inline-block"
                    >
                      Watch video →
                    </a>
                  )}
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{l.content}</p>
                </div>
              ))}
              {m.lessons.length === 0 && (
                <p className="text-sm text-slate-400">No lessons added to this module yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!enrollment.certificate && (
        <div className="mt-10">
          <CompleteButton enrollmentId={enrollment.id} />
        </div>
      )}
    </div>
  );
}
