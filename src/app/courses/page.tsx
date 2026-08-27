import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await prisma.course.findMany({
    where: { published: true },
    include: { organization: true, approach: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">MEGA Academy</h1>
      <p className="text-slate-500 mb-8">
        Courses from verified education organizations across the network.
      </p>

      {courses.length === 0 ? (
        <p className="text-slate-400">
          No courses published yet.{" "}
          <Link href="/register-organization" className="text-mega-blue font-medium">
            Register an organization
          </Link>{" "}
          to publish the first one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.slug}`}
              className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-slate-800">{c.title}</h3>
              {c.description && (
                <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-400">{c.organization?.name}</span>
                <span className="text-sm font-semibold text-mega-navy">
                  {c.priceCents === 0 ? "Free" : `NPR ${(c.priceCents / 100).toFixed(0)}`}
                </span>
              </div>
              {c.approach && (
                <span className="inline-block mt-2 text-xs bg-blue-50 text-mega-blue rounded-full px-2.5 py-1">
                  {c.approach.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
