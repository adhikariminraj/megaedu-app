import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import PersonAddressManager from "@/components/PersonAddressManager";
import FamilyContactsManager, {
  FamilyContactData,
  TEACHER_RELATIONSHIP_OPTIONS,
} from "@/components/FamilyContactsManager";
import { AddressFormValue } from "@/components/AddressForm";
import { verifySchoolAccess } from "@/lib/institutionalContext";

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

  // Never resolved from the viewer's own Teacher.schoolId/approved
  // bridge fields, which can go stale (see src/lib/affiliation.ts's
  // syncTeacherBridgeFields doc comment) — verifySchoolAccess() re-
  // checks a fresh ACTIVE TeacherSchoolAffiliation (or a real
  // SchoolAdmin link) against this TARGET teacher's own current school.
  const access = await verifySchoolAccess(userId, teacher.schoolId);
  if (!access) redirect("/dashboard");
  const isAdmin = access.role === "SCHOOL_ADMIN";
  const teacherAddresses = teacher.user?.addresses ?? [];

  // Whole-Ecosystem Refinement A — current teaching responsibilities,
  // read from the same structured models TeacherDashboard already
  // renders for the teacher themselves (TeacherAcademicAssignment /
  // ClassTeacherAssignment), scoped to THIS teacher's id and the
  // school's current ACTIVE session only. Never the viewer's own
  // assignments — this answers "what does THIS teacher do", not
  // "what do I do".
  const activeSession = await prisma.academicSession.findFirst({
    where: { schoolId: teacher.schoolId, status: "ACTIVE" },
  });
  const [academicAssignments, classTeacherAssignments] = activeSession
    ? await Promise.all([
        prisma.teacherAcademicAssignment.findMany({
          where: { teacherId: teacher.id, academicSessionId: activeSession.id },
          include: { schoolGrade: true, section: true, subject: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.classTeacherAssignment.findMany({
          where: { teacherId: teacher.id, academicSessionId: activeSession.id },
          include: { schoolGrade: true, section: true },
          orderBy: { createdAt: "asc" },
        }),
      ])
    : [[], []];

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

  // Family & Emergency Contacts are administrative records visible to
  // School Admin only — not visible to the Teacher themselves (My
  // Profile is untouched) or to any other Teacher viewing this page.
  // Not fetched at all unless isAdmin, same as the Student page.
  let familyContacts: FamilyContactData[] = [];
  if (isAdmin) {
    const contacts = await prisma.familyContact.findMany({
      where: { teacherId: teacher.id },
      include: { addresses: { where: { label: "CURRENT" } } },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
    familyContacts = contacts.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      relationship: c.relationship,
      relationshipOther: c.relationshipOther,
      mobileNumber: c.mobileNumber,
      isPrimaryContact: c.isPrimaryContact,
      isGuardian: c.isGuardian,
      isEmergencyContact: c.isEmergencyContact,
      isActive: c.isActive,
      address: toAddressValue(c.addresses[0]),
    }));
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{teacher.school?.name}</p>
      <div className="flex items-center gap-3 mb-1">
        <Avatar src={teacher.user?.avatarUrl ?? null} name={teacher.fullName} size="lg" />
        <h1 className="text-2xl font-bold text-slate-800">{teacher.fullName}</h1>
      </div>
      {teacher.user?.email && <p className="text-sm text-slate-500 mb-1">{teacher.user.email}</p>}
      <p className="text-sm text-slate-500 mb-6">
        {teacher.position}
        {teacher.subjects ? ` · ${teacher.subjects}` : ""}
        {" · "}
        <span className={teacher.approved ? "text-mega-green" : "text-amber-600"}>
          {teacher.approved ? "Approved" : "Pending School Approval"}
        </span>
      </p>

      {isAdmin && (
        <div className="flex flex-wrap gap-3 text-xs mb-8">
          {/* Whole-Ecosystem Refinement C — these actions operate on the
              SCHOOL's academics/meetings surfaces (an Admin capability),
              not a per-teacher management context that doesn't exist yet.
              Scoped to this teacher (?teacher=) where the target page
              supports it; relabeled honestly where it doesn't, so a School
              Admin never mistakes a school-wide action for one confined to
              the profile they're viewing. Hidden entirely from a fellow
              Teacher viewer, who holds no authority on either page. */}
          <Link href="/dashboard/academics" className="text-mega-blue font-medium">
            Manage school's subjects & assignments →
          </Link>
          <Link href={`/dashboard/meetings?teacher=${teacher.id}`} className="text-mega-blue font-medium">
            View this teacher's meetings →
          </Link>
        </div>
      )}

      {teacher.approved && (
        <div className="mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Current Responsibilities</h3>
          <p className="text-xs text-slate-400 mb-4">
            {activeSession
              ? `Academic assignments for the current session (${activeSession.name}).`
              : "This school has no active academic session yet."}
          </p>
          {academicAssignments.length === 0 && classTeacherAssignments.length === 0 ? (
            <p className="text-slate-400 text-sm">
              {activeSession
                ? "No academic assignments for the current session."
                : "Nothing to show until an academic session is active."}
            </p>
          ) : (
            <div className="space-y-2">
              {academicAssignments.map((a) => (
                <div
                  key={a.id}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700"
                >
                  {a.schoolGrade.displayName} — {a.subject.name} —{" "}
                  <span className="text-slate-400">
                    {a.section ? `Section ${a.section.name}` : "All sections"}
                  </span>
                </div>
              ))}
              {classTeacherAssignments.map((c) => (
                <div
                  key={c.id}
                  className="border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700"
                >
                  {c.schoolGrade.displayName} —{" "}
                  <span className="text-slate-400">
                    {c.section ? `Class Teacher — Section ${c.section.name}` : "Grade Coordinator"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {isAdmin && (
        <div className="mt-8">
          <h3 className="font-semibold text-slate-800 mb-1">Family &amp; Emergency Contacts</h3>
          <p className="text-xs text-slate-400 mb-4">
            Administrative records for this teacher's official school file — visible to School Admin
            only. A contact here is entirely separate from MEGA ID / portal access; linking one to an
            existing account is never automatic.
          </p>
          <FamilyContactsManager
            baseUrl={`/api/schools/${teacher.schoolId}/teachers/${teacher.id}/contacts`}
            contacts={familyContacts}
            relationshipOptions={TEACHER_RELATIONSHIP_OPTIONS}
            showGuardianFlag={false}
          />
        </div>
      )}
    </div>
  );
}
