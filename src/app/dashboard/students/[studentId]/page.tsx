import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AcademicProgressPanel from "@/components/AcademicProgressPanel";
import AcademicSnapshot from "@/components/AcademicSnapshot";
import StudentHomeworkSummary from "@/components/StudentHomeworkSummary";
import EditStudentInfoForm from "@/components/EditStudentInfoForm";
import Avatar from "@/components/Avatar";
import PersonAddressManager from "@/components/PersonAddressManager";
import FamilyContactsManager, {
  FamilyContactData,
  STUDENT_RELATIONSHIP_OPTIONS,
} from "@/components/FamilyContactsManager";
import { AddressFormValue } from "@/components/AddressForm";
import { fetchAcademicProgress, fetchMeetingsForStudent } from "@/lib/academicProgress";
import { fetchAssessmentResults, toSubjectResultRows, computeUnweightedAveragePercentage } from "@/lib/assessmentResults";
import { fetchStudentHomeworkHistory } from "@/lib/homework";
import { computeStudentHomeworkCompletion } from "@/lib/homeworkRollup";
import { computeAttendanceSummary } from "@/lib/attendance";
import { verifySchoolAccess } from "@/lib/institutionalContext";
import { resolveOpenStudentAffiliation } from "@/lib/affiliation";
import { resolveCurrentPlacement } from "@/lib/gradeHistory";

function formatDateOfBirth(d: Date): string {
  // UTC, matching this codebase's date-only storage convention — the
  // value is already UTC-midnight, so displaying in UTC is the only way
  // to avoid the local viewer's timezone silently shifting the date.
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    d
  );
}

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

  // Never resolved from the Teacher.schoolId/approved bridge fields,
  // which can go stale (see src/lib/affiliation.ts's
  // syncTeacherBridgeFields doc comment) — verifySchoolAccess() re-
  // checks a fresh ACTIVE TeacherSchoolAffiliation (or a real
  // SchoolAdmin link) against this student's own current school.
  const access = await verifySchoolAccess(userId, student.schoolId);
  if (!access) redirect("/dashboard");
  const isAdmin = access.role === "SCHOOL_ADMIN";
  const studentAddresses = student.user?.addresses ?? [];

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

  // Same school-and-session-scoped placement resolution
  // fetchAssessmentResults()/fetchAcademicProgress() already use
  // internally — reused here (not the page's own student.gradeHistory
  // include above, which filters academicSession.status but not
  // schoolId) so the Academic Snapshot can never accidentally pull
  // attendance/homework from a different school's still-ACTIVE session.
  const currentPlacement = await resolveCurrentPlacement(student.id, student.schoolId);

  const [progress, meetings, assessment, homeworkHistory, affiliation, attendanceSummary, homeworkCompletionSummary] =
    await Promise.all([
      fetchAcademicProgress(student.id, student.schoolId, "STAFF"),
      fetchMeetingsForStudent(student.id, "STAFF"),
      fetchAssessmentResults(student.id, student.schoolId, "STAFF"),
      fetchStudentHomeworkHistory(student.id),
      resolveOpenStudentAffiliation(student.id, student.schoolId),
      currentPlacement ? computeAttendanceSummary(student.id, currentPlacement.academicSessionId) : null,
      currentPlacement ? computeStudentHomeworkCompletion(student.id, currentPlacement.academicSessionId) : null,
    ]);

  // Overall Performance: the same GPA-or-average-percentage fallback
  // chain already used by the Promotion/Grade-Decision ranking page
  // (src/app/dashboard/grades/[schoolGradeId]/page.tsx) — GPA when any
  // subject resolves a gradePoint, else the unweighted average
  // percentage, else no figure at all. assessment.gpa is already
  // computed above; no new assessment query.
  const overallPerformance: { value: number; basis: "GPA" | "PERCENTAGE" } | null =
    typeof assessment.gpa === "number"
      ? { value: assessment.gpa, basis: "GPA" }
      : (() => {
          const avg = computeUnweightedAveragePercentage(assessment.subjects);
          return typeof avg === "number" ? { value: avg, basis: "PERCENTAGE" } : null;
        })();

  const placement = student.gradeHistory[0];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-sm text-slate-400 mb-1">{student.school?.name}</p>
      <div className="flex items-center gap-3 mb-1">
        <Avatar src={student.user?.avatarUrl ?? null} name={student.fullName} size="lg" />
        <h1 className="text-2xl font-bold text-slate-800">{student.fullName}</h1>
      </div>
      {student.user?.email && <p className="text-sm text-slate-500 mb-1">{student.user.email}</p>}
      <p className="text-sm text-slate-500 mb-1">
        {placement
          ? `${placement.schoolGrade.displayName}${placement.section ? ` — Section ${placement.section.name}` : ""} · ${placement.academicSession.name}`
          : student.gradeLevel || "No current grade placement"}
        {" · "}
        <span className={student.approved ? "text-mega-green" : "text-amber-600"}>
          {student.approved ? "Approved" : "Pending School Approval"}
        </span>
      </p>

      <div className="text-sm text-slate-500 mb-2 space-y-0.5">
        {student.userId && (
          <p>
            MEGA ID: <span className="font-mono text-xs text-slate-600">{student.userId}</span>
          </p>
        )}
        <p>
          Student ID:{" "}
          {affiliation?.admissionNumber ? affiliation.admissionNumber : <span className="text-slate-400">Not set</span>}
        </p>
        <p>
          Date of Birth:{" "}
          {student.dateOfBirth ? (
            formatDateOfBirth(student.dateOfBirth)
          ) : (
            <span className="text-slate-400">Not set</span>
          )}
        </p>
      </div>

      <AcademicSnapshot
        attendancePercentage={attendanceSummary?.attendancePercentage ?? null}
        homeworkCompletionPercentage={homeworkCompletionSummary?.completionPercentage ?? null}
        overallPerformance={overallPerformance}
      />

      {isAdmin && (
        <div className="mb-6">
          <EditStudentInfoForm
            schoolId={student.schoolId}
            studentId={student.id}
            initialAdmissionNumber={affiliation?.admissionNumber ?? null}
            initialDateOfBirth={student.dateOfBirth ? student.dateOfBirth.toISOString().slice(0, 10) : null}
          />
        </div>
      )}

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
            relationshipOptions={STUDENT_RELATIONSHIP_OPTIONS}
            showGuardianFlag
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

      <StudentHomeworkSummary rows={homeworkHistory} />

      <p className="text-xs mb-8">
        <Link href={`/dashboard/report-card/${student.id}`} className="text-mega-blue font-medium">
          View full Report Card →
        </Link>
        {" · "}
        <Link href={`/dashboard/students/${student.id}/mark-sheet`} className="text-mega-blue font-medium">
          Annual Mark Sheet →
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
