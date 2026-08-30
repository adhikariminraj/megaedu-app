import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";

/**
 * Adds one AssessmentPeriod to an existing framework — `order` is
 * app-assigned (current count in the framework + 1), the same
 * convention already used for TeachingUnit.order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; frameworkId: string } }
) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const framework = await prisma.assessmentFramework.findUnique({ where: { id: params.frameworkId } });
  if (!framework || framework.schoolId !== params.id) {
    return NextResponse.json({ error: "Framework not found." }, { status: 404 });
  }

  const { name } = (await req.json()) as { name?: string };
  const trimmed = name?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "A period name is required." }, { status: 400 });
  }

  const count = await prisma.assessmentPeriod.count({ where: { frameworkId: params.frameworkId } });

  try {
    const period = await prisma.assessmentPeriod.create({
      data: { frameworkId: params.frameworkId, name: trimmed, order: count },
    });
    return NextResponse.json({ ok: true, period });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "This framework already has a period with that name." },
        { status: 409 }
      );
    }
    throw err;
  }
}
