import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organizations — MEGA.EDU",
  description: "Discover verified training providers and education organizations across the MEGA.EDU network.",
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: { q?: string; academy?: string };
}) {
  const q = searchParams.q?.trim() || "";
  const academyOnly = searchParams.academy === "1";

  // Same verified && isActive guard /organizations/[slug] already enforces
  // (previously this directory checked `verified` only). Search and filter
  // mirror /schools' query-param form — no new search infrastructure.
  const organizations = await prisma.organization.findMany({
    where: {
      verified: true,
      isActive: true,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}),
      ...(academyOnly ? { academyParticipant: true } : {}),
    },
    orderBy: { name: "asc" },
  });

  const hasFilters = q || academyOnly;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Organizations</h1>
      <p className="text-slate-500 mb-8">
        Verified training providers, publishers and education organizations.
      </p>

      <form className="mb-8 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Organization name or description..."
            className="w-full border border-slate-300 rounded-full px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 px-2 py-2.5">
          <input type="checkbox" name="academy" value="1" defaultChecked={academyOnly} />
          MEGA Academy providers only
        </label>

        <button
          type="submit"
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition"
        >
          Search
        </button>
        {hasFilters && (
          <Link href="/organizations" className="text-sm text-slate-500 hover:text-slate-700 px-2 py-2.5">
            Clear
          </Link>
        )}
      </form>

      {organizations.length === 0 ? (
        <p className="text-slate-400">
          {hasFilters ? "No organizations match these filters." : "No verified organizations yet."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {organizations.map((o) => (
            <Link
              key={o.id}
              href={`/organizations/${o.slug}`}
              className="flex items-start gap-4 border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <Avatar src={o.logoUrl} name={o.name} variant="school" size="lg" />
              <div>
                <h3 className="font-semibold text-slate-800">{o.name}</h3>
                {o.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{o.description}</p>
                )}
                {o.academyParticipant && (
                  <span className="inline-block mt-3 text-xs font-semibold bg-blue-50 text-mega-blue rounded-full px-2.5 py-1">
                    ✓ MEGA Academy Provider
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
