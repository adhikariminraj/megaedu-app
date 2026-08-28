import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";

  const schools = await prisma.school.findMany({
    where: {
      verified: true,
      isActive: true,
      ...(q ? { name: { contains: q } } : {}),
    },
    select: { id: true, name: true, location: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json({ schools });
}
