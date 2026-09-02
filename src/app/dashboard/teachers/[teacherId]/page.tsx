import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import PersonAddressManager from "@/components/PersonAddressManager";
import { AddressFormValue } from "@/components/AddressForm";

export const dynamic = "force-dynamic";

/**
 * Teacher Profile for School Admin use — the Teacher-side counterpart to
 * students/[studentId]/page.tsx, created here since no equivalent page
 * previously existed (Teachers were only ever listed inline in the
 * Staff tab). Kept focused on identity + the new Official Address on
 * Record; it does not duplicate the academic-assignment views already
 * available elsewhere (Academic Sessions & Grades, Subjects & Teacher
 * Assignments).
 *
 * Access mirrors the Student profile page exactly: any School Admin of
 * this teacher's school, or any other approved Teacher at that school,
 * may view — but address correction authority is School-Admin-only.
 */
export default async function TeacherProfilePage({ params }: { params: { teacherId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const teacher = await prisma.teacher.findUnique({
    where: { id: params.teacherId },
    include: {
      user: { include: { addresses: { where: { label: { in: ["CURRENT", "PERMANENT"] } } } } },
      school: true,
    },
  });
  if (!teacher || !teacher.schoolId) notFound();

  const [schoolAdmin, viewerTeacher] = await Promise.all([
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: teacher.schoolId } } }),
    prisma.teacher.findFirst({ where: { userId, schoolId: teacher.schoolId, approved: true } }),
  ]);
  if (!schoolAdmin && !viewerTeacher) redirect("/dashboard");
  const isAdmin = !!schoolAdmin;
  const teacherAddresses = teacher.user.addresses;

  function toAddressValue(a: (typeof teacherAddresses)[number] | undefined): AddressFormValue | null {
    if (!a) return null;
    return {
      provinceId: a.provinceId,
      districtId: a.districtId,
      localLevelId: a.localLevelId,
      wardNumber: a.wardNumber,
      streetAddress: a.streetAddress || "",
      houseNumber: a.houseNumber || "",
    };
  }
  const currentAddress = toAddressValue(teacherAddresses.find((a) => a.label === "CURRENT"));
  const permanentAddress = toAddressValue(teacherAddresses.find((a) => a.label === "PERMANENT"));

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{teacher.school?.name}</p>
      <div className="flex items-center gap-3 mb-1">
        <Avatar src={teacher.user.avatarUrl} name={teacher.user.name} size="lg" />
        <h1 className="text-2xl font-bold text-slate-800">{teacher.user.name}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-1">{teacher.user.email}</p>
      <p className="text-sm text-slate-500 mb-6">
        {teacher.position}
        {teacher.subjects ? ` · ${teacher.subjects}` : ""}
        {" · "}
        <span className={teacher.approved ? "text-mega-green" : "text-amber-600"}>
          {teacher.approved ? "Approved" : "Pending School Approval"}
        </span>
      </p>

      <div className="flex flex-wrap gap-3 text-xs mb-8">
        <Link href="/dashboard/academics" className="text-mega-blue font-medium">
          Manage subjects & assignments →
        </Link>
        <Link href="/dashboard/meetings" className="text-mega-blue font-medium">
          Manage meetings →
        </Link>
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Official Address on Record</h3>
        <p className="text-xs text-slate-400 mb-4">
          {isAdmin
            ? "Part of this teacher's official school record. Corrections here update the same address the teacher maintains from their own My Profile."
            : "Read-only — only a School Admin can correct a teacher's address on record."}
        </p>
        <PersonAddressManager
          patchUrl={`/api/schools/${teacher.schoolId}/teachers/${teacher.id}/address`}
          current={currentAddress}
          permanent={permanentAddress}
          readOnly={!isAdmin}
        />
      </div>
    </div>
  );
}
