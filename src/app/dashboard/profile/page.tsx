import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfilePhotoManager from "@/components/ProfilePhotoManager";
import ProfileAddressManager from "@/components/ProfileAddressManager";
import ChangePasswordManager from "@/components/ChangePasswordManager";
import CopyMegaId from "@/components/CopyMegaId";
import InstitutionalRelationships from "@/components/InstitutionalRelationships";
import { AddressFormValue } from "@/components/AddressForm";
import { isDemoAccountEmail } from "@/lib/demoAccount";
import { buildInstitutionalRelationships } from "@/lib/profile";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  ORGANIZATION_ADMIN: "Organization Admin",
  ACCOUNTANT: "Accountant",
};

/**
 * My Profile K1 — "Who am I in MEGA?" Identity, account, security,
 * institutional relationships, and addresses — deliberately not another
 * dashboard (no Homework/Meetings/Calendar/Attendance here).
 *
 * MEGA ID remains exactly `user.id`, unchanged — this page does not
 * introduce a new identifier format or a Person model; it only presents
 * the existing value with more intentional visual weight and a copy
 * action. See docs/PROFILE.md.
 *
 * Institutional relationships are read directly from
 * TeacherSchoolAffiliation/StudentSchoolAffiliation/SchoolAdmin — never
 * from the legacy Teacher.schoolId/Student.schoolId bridge fields,
 * and never with a take:1 that would silently drop a second school.
 * This section is read-only: it does not create, end, or transfer any
 * affiliation (see src/lib/affiliation.ts for that, untouched here).
 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
      teacherProfile: {
        include: {
          schoolAffiliations: { include: { school: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        },
      },
      studentProfile: {
        include: {
          schoolAffiliations: { include: { school: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        },
      },
      // administeredSchools: intentionally NOT take:1 — a School Admin
      // of 2+ schools must see all of them, not an arbitrary one.
      administeredSchools: { include: { school: { select: { name: true } } } },
      addresses: {
        where: { label: { in: ["CURRENT", "PERMANENT"] } },
        include: { province: { select: { name: true } }, district: { select: { name: true } } },
      },
    },
  });
  if (!user) redirect("/login");
  const userAddresses = user.addresses;

  function toAddressEntry(
    a: (typeof userAddresses)[number] | undefined
  ): { value: AddressFormValue; summary: string } | null {
    if (!a) return null;
    return {
      value: {
        provinceId: a.provinceId,
        districtId: a.districtId,
        localLevelId: a.localLevelId,
        wardNumber: a.wardNumber,
        streetAddress: a.streetAddress || "",
        houseNumber: a.houseNumber || "",
      },
      summary: `${a.district.name}, ${a.province.name}`,
    };
  }
  const currentAddress = toAddressEntry(userAddresses.find((a) => a.label === "CURRENT"));
  const permanentAddress = toAddressEntry(userAddresses.find((a) => a.label === "PERMANENT"));
  const isDemoAccount = isDemoAccountEmail(user.email);

  // Organization relationships: deliberately not shown. OrganizationAdmin/
  // OrganizationAccountant are flat join tables with no status/date
  // columns and no verifyOrgAccess()-equivalent institutional-context
  // layer (unlike School, which has TeacherSchoolAffiliation/
  // StudentSchoolAffiliation + institutionalContext.ts). Showing an
  // Organization relationship here would mean inventing a maturity the
  // data model doesn't have yet — deferred, not attempted.

  const relationships = buildInstitutionalRelationships({
    teacherAffiliations: user.teacherProfile?.schoolAffiliations,
    studentAffiliations: user.studentProfile?.schoolAffiliations,
    administeredSchools: user.administeredSchools,
  });
  const hasSchoolAdminRows = user.administeredSchools.length > 0;

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      {/* ============ My MEGA Identity ============ */}
      <div className="border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4">
          <ProfilePhotoManager name={user.name} avatarUrl={user.avatarUrl} />
        </div>

        <div className="mt-5">
          <h1 className="text-xl font-bold text-slate-800">{user.name}</h1>

          <div className="flex items-center gap-2 mt-1">
            <p className="font-mono text-xs text-slate-500">{user.id}</p>
            <CopyMegaId id={user.id} />
          </div>
          <p className="text-xs text-slate-400 mt-1">MEGA ID</p>

          <div className="flex gap-2 flex-wrap mt-3">
            {user.roles.map((r) => (
              <span
                key={r.id}
                className="text-xs font-semibold bg-blue-50 text-mega-navy rounded-full px-3 py-1"
              >
                {ROLE_LABELS[r.role] || r.role}
              </span>
            ))}
          </div>

          <p className="text-sm text-slate-500 mt-4">{user.email}</p>
        </div>
      </div>

      {/* ============ My Institutional Relationships ============ */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">My Institutional Relationships</h2>
        <p className="text-sm text-slate-500 mb-4">
          Every school you&apos;re currently or were previously affiliated with.
        </p>
        <InstitutionalRelationships relationships={relationships} hasSchoolAdminRows={hasSchoolAdminRows} />
      </div>

      {/* ============ Security & Account ============ */}
      <div className="mb-6 border border-slate-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Security &amp; Account</h2>
        {isDemoAccount ? (
          <p className="text-sm text-slate-500">
            You can&apos;t change your password. You are using a demo account.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Your password is your own credential — changing it never affects your MEGA ID, roles, or
              school affiliations.
            </p>
            <ChangePasswordManager />
          </>
        )}
      </div>

      {/* ============ Addresses ============ */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Addresses</h2>
        <p className="text-sm text-slate-500 mb-4">
          Your Current and Permanent address, using Nepal&apos;s Province / District / Local Level
          / Ward structure. Your school administration can also view and correct these as part of
          your official record.
        </p>
        <ProfileAddressManager current={currentAddress} permanent={permanentAddress} />
      </div>
    </div>
  );
}
