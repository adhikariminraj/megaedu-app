import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ApproachesPage() {
  const approaches = await prisma.educationalApproach.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { schools: true, courses: true, resources: true } } },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Educational Approaches</h1>
      <p className="text-slate-500 mb-8">
        CBE, STEM, Montessori and other pedagogies — each with its own community
        of schools, courses and resources.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {approaches.map((a) => (
          <Link
            key={a.id}
            href={`/approaches/${a.slug}`}
            className="block border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
          >
            <h3 className="font-semibold text-slate-800">{a.name}</h3>
            {a.description && <p className="text-sm text-slate-500 mt-1">{a.description}</p>}
            <p className="text-xs text-slate-400 mt-3">
              {a._count.schools} schools · {a._count.courses} courses ·{" "}
              {a._count.resources} resources
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
