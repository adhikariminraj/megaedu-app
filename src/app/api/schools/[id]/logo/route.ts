import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin } from "@/lib/authorize";
import { saveUploadedImage, deleteUploadedImage, UploadValidationError } from "@/lib/uploads";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  let newUrl: string;
  try {
    newUrl = await saveUploadedImage(file, `schools/${params.id}`);
  } catch (e) {
    if (e instanceof UploadValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // Save the new file and commit the DB update FIRST — only delete the
  // previous logo file once both have succeeded, so a failure partway
  // through never leaves the school without any logo.
  const previous = await prisma.school.findUnique({ where: { id: params.id }, select: { logoUrl: true } });
  const school = await prisma.school.update({
    where: { id: params.id },
    data: { logoUrl: newUrl },
    select: { logoUrl: true },
  });

  if (previous?.logoUrl && previous.logoUrl !== newUrl) {
    await deleteUploadedImage(previous.logoUrl);
  }

  return NextResponse.json({ ok: true, logoUrl: school.logoUrl });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireSchoolAdmin(params.id);
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const previous = await prisma.school.findUnique({ where: { id: params.id }, select: { logoUrl: true } });
  await prisma.school.update({ where: { id: params.id }, data: { logoUrl: null } });

  if (previous?.logoUrl) {
    await deleteUploadedImage(previous.logoUrl);
  }

  return NextResponse.json({ ok: true });
}
