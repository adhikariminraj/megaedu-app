import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
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

  // Kilometer 2B — public visibility now also requires the owning
  // organization to be currently eligible (verified, an active MEGA
  // Academy participant, and not deactivated), matching the exact
  // condition applied on /courses. An organization with none of these
  // yet true (e.g. a brand-new course whose organizationId is null,
  // though nothing today creates one that way) is intentionally not
  // subject to this check — there is no organization to verify.
  const orgIneligible =
    !!course?.organization &&
    (!course.organization.verified || !course.organization.academyParticipant || !course.organization.isActive);
  if (!course || !course.published || orgIneligible) notFound();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  // Academy Participation kilometer — resolved by the enrollment's own
  // direct userId. Previously this fell back to an unscoped {} filter
  // (matching ANY enrollment for the course, by anyone) whenever the
  // viewer held neither a Teacher nor a Student profile — dormant while
  // enrollment required one of those profiles, but would have leaked a
  // stranger's enrollment id the moment that requirement was lifted.
  let existingEnrollmentId: string | null = null;
  if (userId) {
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: { courseId: course.id, userId },
    });
    existingEnrollmentId = enrollment?.id || null;
  }

  return (
    <div>
      <div className="bg-mega-navy text-white">
        <div className="max-w-4xl mx-auto px-6 py-16">
          {course.organization ? (
            <Link
              href={`/organizations/${course.organization.slug}`}
              className="text-slate-300 text-sm mb-2 block w-fit hover:text-white hover:underline"
            >
              {course.organization.name}
            </Link>
          ) : (
            <p className="text-slate-300 text-sm mb-2" />
          )}
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
