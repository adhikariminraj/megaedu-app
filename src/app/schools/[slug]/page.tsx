import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SchoolProfilePage({ params }: { params: { slug: string } }) {
  const school = await prisma.school.findUnique({
    where: { slug: params.slug },
    include: {
      programs: true,
      events: { orderBy: { startsAt: "asc" }, take: 5 },
      news: { orderBy: { publishedAt: "desc" }, take: 5 },
      approaches: { include: { approach: true } },
    },
  });

  if (!school) notFound();

  return (
    <div>
      <div className="bg-mega-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-3xl md:text-4xl font-bold">{school.name}</h1>
          <p className="text-slate-300 mt-2">
            {school.location || "Nepal"}
            {school.gradesOffered ? ` · Grades ${school.gradesOffered}` : ""}
          </p>
          {school.approaches.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {school.approaches.map((sa) => (
                <span
                  key={sa.id}
                  className="text-xs font-semibold bg-white/10 border border-white/20 rounded-full px-3 py-1"
                >
                  {sa.approach.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-10">
          {school.description && (
            <section>
              <h2 className="text-xl font-semibold text-slate-800 mb-3">About</h2>
              <p className="text-slate-600 leading-relaxed">{school.description}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Programs</h2>
            {school.programs.length === 0 ? (
              <p className="text-slate-400 text-sm">No programs listed yet.</p>
            ) : (
              <ul className="space-y-2">
                {school.programs.map((p) => (
                  <li key={p.id} className="border border-slate-200 rounded-lg p-4">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {p.description && (
                      <p className="text-sm text-slate-500 mt-1">{p.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">News</h2>
            {school.news.length === 0 ? (
              <p className="text-slate-400 text-sm">No news posted yet.</p>
            ) : (
              <ul className="space-y-4">
                {school.news.map((n) => (
                  <li key={n.id}>
                    <p className="font-medium text-slate-800">{n.title}</p>
                    <p className="text-sm text-slate-500">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Contact</h3>
            {school.contactEmail && (
              <p className="text-sm text-slate-600">{school.contactEmail}</p>
            )}
            {school.contactPhone && (
              <p className="text-sm text-slate-600">{school.contactPhone}</p>
            )}
            {!school.contactEmail && !school.contactPhone && (
              <p className="text-sm text-slate-400">Not published.</p>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Upcoming Events</h3>
            {school.events.length === 0 ? (
              <p className="text-sm text-slate-400">No upcoming events.</p>
            ) : (
              <ul className="space-y-3">
                {school.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="font-medium text-slate-800">{e.title}</p>
                    <p className="text-slate-500">
                      {new Date(e.startsAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
