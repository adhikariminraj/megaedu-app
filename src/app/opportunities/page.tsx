import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const TYPE_COLORS: Record<string, string> = {
  Scholarship: "bg-amber-50 text-mega-gold",
  Competition: "bg-purple-50 text-mega-purple",
  Event: "bg-blue-50 text-mega-blue",
  Job: "bg-green-50 text-mega-green",
  Other: "bg-slate-100 text-slate-600",
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const typeFilter = searchParams.type;

  const opportunities = await prisma.opportunity.findMany({
    where: typeFilter ? { type: typeFilter } : undefined,
    include: { school: true, organization: true },
    orderBy: { createdAt: "desc" },
  });

  const types = ["Scholarship", "Competition", "Event", "Job", "Other"];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Opportunities</h1>
      <p className="text-slate-500 mb-8">
        Scholarships, competitions, events and jobs posted by verified schools
        and organizations across the network.
      </p>

      <div className="flex gap-2 flex-wrap mb-8">
        <a
          href="/opportunities"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            !typeFilter ? "bg-mega-navy text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          All
        </a>
        {types.map((t) => (
          <a
            key={t}
            href={`/opportunities?type=${t}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
              typeFilter === t ? "bg-mega-navy text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {t}
          </a>
        ))}
      </div>

      {opportunities.length === 0 ? (
        <p className="text-slate-400">
          No opportunities posted yet. Verified schools and organizations can
          post scholarships, competitions, events, and jobs from their
          dashboard.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {opportunities.map((o) => (
            <div key={o.id} className="border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-800">{o.title}</h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                    TYPE_COLORS[o.type] || TYPE_COLORS.Other
                  }`}
                >
                  {o.type}
                </span>
              </div>
              {o.description && (
                <p className="text-sm text-slate-500 mt-2">{o.description}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-400">
                  {o.school?.name || o.organization?.name}
                  {o.deadline &&
                    ` · Deadline: ${new Date(o.deadline).toLocaleDateString()}`}
                </span>
                {o.applyUrl && (
                  <a
                    href={o.applyUrl}
                    target="_blank"
                    className="text-sm font-semibold text-mega-blue"
                  >
                    Learn more →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
