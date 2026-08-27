import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  orgName: z.string().min(2),
  description: z.string().optional(),
  website: z.string().optional(),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { adminName, adminEmail, adminPassword, orgName, description, website } = parsed.data;
  const email = adminEmail.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  let slug = slugify(orgName);
  const slugTaken = await prisma.organization.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: adminName,
        email,
        passwordHash,
        roles: { create: [{ role: "ORGANIZATION_ADMIN" }] },
      },
    });

    const organization = await tx.organization.create({
      data: { name: orgName, slug, description, website, verified: false },
    });

    await tx.organizationAdmin.create({
      data: { userId: user.id, organizationId: organization.id },
    });

    return { organization };
  });

  return NextResponse.json({ ok: true, orgSlug: result.organization.slug });
}
