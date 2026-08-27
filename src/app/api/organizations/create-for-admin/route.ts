import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const roles = (session?.user as any)?.roles as string[] | undefined;
  if (!userId) return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  if (!roles?.includes("ORGANIZATION_ADMIN")) {
    return NextResponse.json({ error: "Your MEGA ID isn't registered as an Organization." }, { status: 403 });
  }

  const existing = await prisma.organizationAdmin.findFirst({ where: { userId } });
  if (existing) {
    return NextResponse.json({ error: "You already administer an organization." }, { status: 409 });
  }

  const { orgName, description, website } = await req.json();
  if (!orgName?.trim()) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  let slug = slugify(orgName);
  const slugTaken = await prisma.organization.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const organization = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { name: orgName, slug, description, website, verified: false },
    });
    await tx.organizationAdmin.create({ data: { userId, organizationId: created.id } });
    return created;
  });

  return NextResponse.json({ ok: true, organization });
}
