import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function SchoolsDirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim() || "";

  const schools = await prisma.school.findMany({
    where: {
      verified: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { location: { contains: q } },
              { district: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">School Directory</h1>
      <p className="text-slate-500 mb-8">
        Verified schools across the MEGA.EDU network.
      </p>

      <form className="mb-8">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by school name or location..."
          className="w-full max-w-md border border-slate-300 rounded-full px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </form>

      {schools.length === 0 ? (
        <p className="text-slate-500">
          No schools found{q ? ` for "${q}"` : ""} yet.{" "}
          <Link href="/register-school" className="text-mega-blue font-medium">
            Be the first to register
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {schools.map((s) => (
            <Link
              key={s.id}
              href={`/schools/${s.slug}`}
              className="flex items-start gap-4 border border-slate-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <Avatar src={s.logoUrl} name={s.name} variant="school" size="lg" />
              <div>
                <h3 className="font-semibold text-slate-800">{s.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{s.location || "Nepal"}</p>
                {s.gradesOffered && (
                  <p className="text-xs text-slate-400 mt-2">Grades {s.gradesOffered}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
