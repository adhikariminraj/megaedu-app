import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find a School — MEGA.EDU",
  description: "Discover verified schools across the MEGA.EDU network by name, location, and educational approach.",
};

export default async function SchoolsDirectoryPage({
  searchParams,
}: {
  searchParams: { q?: string; districtId?: string; approachId?: string };
}) {
  const q = searchParams.q?.trim() || "";
  const districtId = searchParams.districtId?.trim() || "";
  const approachId = searchParams.approachId?.trim() || "";

  // Structured-location and approach filter options are scoped to
  // districts/approaches that actually have at least one publicly
  // reachable school — otherwise a school-less filter list would just
  // be noise for a small, growing network. Both reuse existing,
  // already-populated reference data (District, EducationalApproach) —
  // no new geographic infrastructure introduced.
  const [schools, districts, approaches] = await Promise.all([
    prisma.school.findMany({
      where: {
        verified: true,
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { location: { contains: q } },
                { district: { contains: q } },
              ],
            }
          : {}),
        ...(districtId ? { addresses: { some: { label: "OFFICIAL", districtId } } } : {}),
        ...(approachId ? { approaches: { some: { approachId } } } : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.district.findMany({
      where: {
        addresses: { some: { label: "OFFICIAL", school: { is: { verified: true, isActive: true } } } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.educationalApproach.findMany({
      where: { schools: { some: { school: { is: { verified: true, isActive: true } } } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const hasFilters = q || districtId || approachId;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Find a School</h1>
      <p className="text-slate-500 mb-8">
        Verified schools across the MEGA.EDU network.
      </p>

      <form className="mb-8 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="School name or location..."
            className="w-full border border-slate-300 rounded-full px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>

        {districts.length > 0 && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">District</label>
            <select
              name="districtId"
              defaultValue={districtId}
              className="w-full border border-slate-300 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue bg-white"
            >
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {approaches.length > 0 && (
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Educational approach</label>
            <select
              name="approachId"
              defaultValue={approachId}
              className="w-full border border-slate-300 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue bg-white"
            >
              <option value="">All approaches</option>
              {approaches.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition"
        >
          Search
        </button>
        {hasFilters && (
          <Link
            href="/schools"
            className="text-sm text-slate-500 hover:text-slate-700 px-2 py-2.5"
          >
            Clear
          </Link>
        )}
      </form>

      {schools.length === 0 ? (
        <p className="text-slate-500">
          No schools found{hasFilters ? " matching these filters" : ""} yet.{" "}
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
