import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
            <div key={o.id} className="border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800">{o.name}</h3>
              {o.description && (
                <p className="text-sm text-slate-500 mt-1">{o.description}</p>
              )}
              {o.website && (
                <Link
                  href={o.website}
                  target="_blank"
                  className="text-sm text-mega-blue mt-2 inline-block"
                >
                  Visit website →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
