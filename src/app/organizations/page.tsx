import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  const organizations = await prisma.organization.findMany({
    where: { verified: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Organizations</h1>
      <p className="text-slate-500 mb-8">
        Verified training providers, publishers and education organizations.
      </p>

      {organizations.length === 0 ? (
        <p className="text-slate-400">No verified organizations yet.</p>
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
