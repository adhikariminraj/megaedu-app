import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AcademicProgressPanel from "@/components/AcademicProgressPanel";
import Avatar from "@/components/Avatar";
import PersonAddressManager from "@/components/PersonAddressManager";
import FamilyContactsManager, { FamilyContactData } from "@/components/FamilyContactsManager";
import { AddressFormValue } from "@/components/AddressForm";
import { fetchAcademicProgress, fetchMeetingsForStudent } from "@/lib/academicProgress";
import { fetchAssessmentResults, toSubjectResultRows } from "@/lib/assessmentResults";

export const dynamic = "force-dynamic";

/**
 * Comprehensive, read-only Student Profile for School Admin / Teacher
 * staff use — aggregates Attendance, Teaching Progress, Unit Test
 * results, and Qualitative Evaluations (via the same
 * fetchAcademicProgress() the Student/Parent dashboards already use,
 * called here with audience: "STAFF" so evaluation visibility isn't
 * filtered) plus Parent-Teacher Meeting history (via
 * fetchMeetingsForStudent(), audience: "STAFF", rendered locally here —
 * deliberately NOT through the shared AcademicProgressPanel, so that
 * component still structurally never carries meeting data anywhere a
 * Student's own render path could reach it).
 *
 * Access mirrors the existing Skills precedent exactly
 * (students/[studentId]/skills/route.ts): any School Admin of this
 * student's school, or any approved Teacher at that school — no
 * per-assignment scoping in this phase, consistent with how Skill
 * management already works school-wide. This is a read-only page; all
 * actions link out to the existing write surfaces rather than
 * duplicating their forms.
 */
export default async function StudentProfilePage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect("/login");

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    include: {
      user: { include: { addresses: { where: { label: { in: ["CURRENT", "PERMANENT"] } } } } },
      school: true,
      gradeHistory: {
        include: { schoolGrade: true, section: true, academicSession: true },
        orderBy: { academicSession: { startDate: "desc" } },
        take: 1,
        where: { academicSession: { status: "ACTIVE" } },
      },
    },
  });
  if (!student || !student.schoolId) notFound();

  const [schoolAdmin, teacher] = await Promise.all([
    prisma.schoolAdmin.findUnique({ where: { userId_schoolId: { userId, schoolId: student.schoolId } } }),
    prisma.teacher.findFirst({ where: { userId, schoolId: student.schoolId, approved: true } }),
  ]);
  if (!schoolAdmin && !teacher) redirect("/dashboard");
  const isAdmin = !!schoolAdmin;
  const studentAddresses = student.user.addresses;

  function toAddressValue(a: (typeof studentAddresses)[number] | undefined): AddressFormValue | null {
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
  const currentAddress = toAddressValue(studentAddresses.find((a) => a.label === "CURRENT"));
  const permanentAddress = toAddressValue(studentAddresses.find((a) => a.label === "PERMANENT"));

  // Family & Emergency Contacts are administrative records visible to
  // School Admin only — not fetched at all for a Teacher viewer, so the
  // data never reaches a render path that isn't authorized to see it.
  let familyContacts: FamilyContactData[] = [];
  if (isAdmin) {
    const contacts = await prisma.familyContact.findMany({
      where: { studentId: student.id },
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

  const [progress, meetings, assessment] = await Promise.all([
    fetchAcademicProgress(student.id, "STAFF"),
    fetchMeetingsForStudent(student.id, "STAFF"),
    fetchAssessmentResults(student.id, "STAFF"),
  ]);

  const placement = student.gradeHistory[0];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{student.school?.name}</p>
      <div className="flex items-center gap-3 mb-1">
        <Avatar src={student.user.avatarUrl} name={student.user.name} size="lg" />
        <h1 className="text-2xl font-bold text-slate-800">{student.user.name}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-1">{student.user.email}</p>
      <p className="text-sm text-slate-500 mb-6">
        {placement
          ? `${placement.schoolGrade.displayName}${placement.section ? ` — Section ${placement.section.name}` : ""} · ${placement.academicSession.name}`
          : student.gradeLevel || "No current grade placement"}
        {" · "}
        <span className={student.approved ? "text-mega-green" : "text-amber-600"}>
          {student.approved ? "Approved" : "Pending School Approval"}
        </span>
      </p>

      <div className="flex flex-wrap gap-3 text-xs mb-8">
        <Link href="/dashboard/evaluations" className="text-mega-blue font-medium">
          Manage general evaluation →
        </Link>
        <Link href="/dashboard/attendance" className="text-mega-blue font-medium">
          Manage attendance →
        </Link>
        <Link href="/dashboard/meetings" className="text-mega-blue font-medium">
          Manage meetings →
        </Link>
      </div>

      <div className="mb-8">
        <h3 className="font-semibold text-slate-800 mb-1">Official Address on Record</h3>
        <p className="text-xs text-slate-400 mb-4">
          {isAdmin
            ? "Part of this student's official school record. Corrections here update the same address the student maintains from their own My Profile."
            : "Read-only — only a School Admin can correct a student's address on record."}
        </p>
        <PersonAddressManager
          patchUrl={`/api/schools/${student.schoolId}/students/${student.id}/address`}
          current={currentAddress}
          permanent={permanentAddress}
          readOnly={!isAdmin}
        />
      </div>

      {isAdmin && (
        <div className="mb-8">
          <h3 className="font-semibold text-slate-800 mb-1">Family &amp; Emergency Contacts</h3>
          <p className="text-xs text-slate-400 mb-4">
            Administrative records for this student's official school file — visible to School Admin
            only. A contact here is entirely separate from MEGA ID / Parent portal access; linking
            one to an existing account is never automatic.
          </p>
          <FamilyContactsManager
            baseUrl={`/api/schools/${student.schoolId}/students/${student.id}/contacts`}
            contacts={familyContacts}
          />
        </div>
      )}

      <AcademicProgressPanel
        attendance={progress.attendance}
        teachingProgress={progress.teachingProgress}
        testResults={progress.testResults}
        evaluations={progress.evaluations}
        subjectResults={toSubjectResultRows(assessment.subjects)}
        gpa={assessment.gpa}
      />

      {progress.attendance.length === 0 &&
        progress.teachingProgress.length === 0 &&
        progress.testResults.length === 0 &&
        progress.evaluations.length === 0 &&
        assessment.subjects.length === 0 && (
          <p className="text-slate-400 text-sm mb-8">No academic activity recorded yet this session.</p>
        )}

      <p className="text-xs mb-8">
        <Link href={`/dashboard/report-card/${student.id}`} className="text-mega-blue font-medium">
          View full Report Card →
        </Link>
      </p>

      <div className="border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-800 mb-1">Parent-Teacher Meetings</h3>
        {meetings.length === 0 ? (
          <p className="text-sm text-slate-400">None scheduled.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="text-sm text-slate-700 border border-slate-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {m.subjectName ?? "General"} — {m.teacherName}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      m.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : m.status === "CANCELLED"
                        ? "bg-slate-100 text-slate-500"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-1">
                  {new Date(m.scheduledAt).toLocaleString()}
                  {m.location ? ` — ${m.location}` : ""}
                </p>
                {m.status === "COMPLETED" && m.outcomeNotes && (
                  <p className="text-slate-600 mt-1 whitespace-pre-wrap">{m.outcomeNotes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
