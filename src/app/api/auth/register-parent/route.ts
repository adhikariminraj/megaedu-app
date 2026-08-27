import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  childEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password, childEmail } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  const childUser = await prisma.user.findUnique({
    where: { email: childEmail.toLowerCase() },
    include: { studentProfile: true },
  });
  if (!childUser?.studentProfile) {
    return NextResponse.json(
      {
        error:
          "We couldn't find a student account with that email. Your child needs to register as a student first.",
      },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        roles: { create: [{ role: "PARENT" }] },
      },
    });

    const parent = await tx.parent.create({ data: { userId: user.id } });

    await tx.parentStudent.create({
      data: { parentId: parent.id, studentId: childUser.studentProfile!.id },
    });
  });

  return NextResponse.json({ ok: true });
}
