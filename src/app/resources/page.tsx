import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const resources = await prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
    include: { approach: true, school: true, organization: true },
    take: 50,
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Resource Centre</h1>
      <p className="text-slate-500 mb-8">
        Lesson plans, guides, and materials shared across the network.
      </p>

      {resources.length === 0 ? (
        <p className="text-slate-400">
          No resources published yet. Once schools and organizations start
          sharing lesson plans, guides and materials, they&apos;ll appear here —
          searchable by subject, grade and educational approach.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resources.map((r) => (
            <div key={r.id} className="border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800">{r.title}</h3>
              {r.description && (
                <p className="text-sm text-slate-500 mt-1">{r.description}</p>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {r.subject && (
                  <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2.5 py-1">
                    {r.subject}
                  </span>
                )}
                {r.approach && (
                  <span className="text-xs bg-blue-50 text-mega-blue rounded-full px-2.5 py-1">
                    {r.approach.name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
