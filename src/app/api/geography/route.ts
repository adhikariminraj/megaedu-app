import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The full Nepal Province -> District -> Local Level reference tree, as
 * flat arrays for cheap client-side cascading-filter joins. Fixed
 * reference data (seeded from prisma/data/nepal-geography.json, never
 * edited from the app) — public and unauthenticated, same as any other
 * static lookup list, and small enough (837 rows total) to ship whole
 * rather than round-tripping per dropdown selection.
 */
export async function GET() {
  const [provinces, districts, localLevels] = await Promise.all([
    prisma.province.findMany({ orderBy: { order: "asc" } }),
    prisma.district.findMany({ orderBy: { name: "asc" } }),
    prisma.localLevel.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    provinces: provinces.map((p) => ({ id: p.id, code: p.code, name: p.name })),
    districts: districts.map((d) => ({ id: d.id, code: d.code, name: d.name, provinceId: d.provinceId })),
    localLevels: localLevels.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      type: l.type,
      wardCount: l.wardCount,
      districtId: l.districtId,
    })),
  });
}
