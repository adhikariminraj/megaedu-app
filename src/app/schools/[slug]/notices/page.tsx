import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Full public notice listing for one school — the "see all" a visitor
 * reaches from the profile page's 5-item preview. Reuses NewsPost as-is
 * (see docs/INSTITUTIONAL_CONTEXT.md-style deferral note: NewsPost's
 * dual public/internal audience is a known, separate architectural
 * question, not something this phase redesigns).
 */
export default async function SchoolNoticesPage({ params }: { params: { slug: string } }) {
  const school = await prisma.school.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      verified: true,
      isActive: true,
      news: { orderBy: { publishedAt: "desc" }, take: 50 },
    },
  });

  if (!school || !school.verified || !school.isActive) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-sm text-slate-400 mb-1">
        <Link href={`/schools/${school.slug}`} className="hover:underline">
          ← {school.name}
        </Link>
      </p>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Public Notices</h1>

      {school.news.length === 0 ? (
        <p className="text-slate-400 text-sm">No notices posted yet.</p>
      ) : (
        <ul className="space-y-4">
          {school.news.map((n) => (
            <li key={n.id} className="border border-slate-200 rounded-xl p-5">
              <Link href={`/schools/${school.slug}/notices/${n.id}`} className="block">
                <p className="font-semibold text-slate-800 hover:text-mega-blue transition">
                  {n.title}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(n.publishedAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{n.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
