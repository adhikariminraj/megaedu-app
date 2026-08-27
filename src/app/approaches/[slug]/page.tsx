import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ApproachPage({ params }: { params: { slug: string } }) {
  const approach = await prisma.educationalApproach.findUnique({
    where: { slug: params.slug },
    include: {
      schools: { include: { school: true } },
      courses: true,
      resources: true,
    },
  });

  if (!approach) notFound();

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">{approach.name}</h1>
      {approach.description && <p className="text-slate-500 mb-10">{approach.description}</p>}

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Schools using {approach.name}</h2>
        {approach.schools.length === 0 ? (
          <p className="text-slate-400 text-sm">No schools linked yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {approach.schools.map((sa) => (
              <Link
                key={sa.id}
                href={`/schools/${sa.school.slug}`}
                className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition"
              >
                <p className="font-medium text-slate-800">{sa.school.name}</p>
                <p className="text-sm text-slate-500">{sa.school.location}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Courses</h2>
        {approach.courses.length === 0 ? (
          <p className="text-slate-400 text-sm">No courses published yet.</p>
        ) : (
          <ul className="space-y-2">
            {approach.courses.map((c) => (
              <li key={c.id} className="border border-slate-200 rounded-lg p-4">
                {c.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-800 mb-4">Resources</h2>
        {approach.resources.length === 0 ? (
          <p className="text-slate-400 text-sm">No resources published yet.</p>
        ) : (
          <ul className="space-y-2">
            {approach.resources.map((r) => (
              <li key={r.id} className="border border-slate-200 rounded-lg p-4">
                {r.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
