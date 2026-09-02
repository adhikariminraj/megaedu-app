"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OpportunityPoster from "@/components/OpportunityPoster";
import AccountantGrantForm from "@/components/AccountantGrantForm";
import DashboardHero, { HeroCard } from "@/components/DashboardHero";
import SchoolLogoManager from "@/components/SchoolLogoManager";
import AddressCard from "@/components/AddressCard";
import { AddressFormValue } from "@/components/AddressForm";

type School = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  logoUrl: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  gradesOffered: string | null;
  programs: { id: string; name: string; description: string | null }[];
  news: { id: string; title: string; body: string }[];
  events: { id: string; title: string; startsAt: string | Date }[];
  opportunities: { id: string; title: string; type: string; deadline: string | Date | null }[];
  teachers: {
    id: string;
    approved: boolean;
    subjects: string | null;
    position: string;
    user: { name: string; email: string };
  }[];
  students: {
    id: string;
    approved: boolean;
    gradeLevel: string | null;
    user: { name: string; email: string };
    placement: {
      gradeHistoryId: string;
      schoolGradeId: string;
      gradeDisplayName: string;
      sectionId: string | null;
      sectionName: string | null;
    } | null;
  }[];
  accountants: { user: { name: string; email: string } }[];
  addresses: {
    id: string;
    provinceId: string;
    districtId: string;
    localLevelId: string;
    wardNumber: number;
    streetAddress: string | null;
    houseNumber: string | null;
  }[];
};
type SchoolGradeOption = { id: string; displayName: string; sections: { id: string; name: string }[] };

export default function DashboardClient({
  school,
  userName,
  activeSession,
  schoolGrades,
}: {
  school: School;
  userName: string;
  activeSession: { id: string; name: string } | null;
  schoolGrades: SchoolGradeOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"profile" | "programs" | "news" | "opportunities" | "staff" | "students" | "finance">("profile");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    description: school.description || "",
    contactEmail: school.contactEmail || "",
    contactPhone: school.contactPhone || "",
    location: school.location || "",
    gradesOffered: school.gradesOffered || "",
  });
  const officialAddress = school.addresses[0];
  const officialAddressValue: AddressFormValue | null = officialAddress
    ? {
        provinceId: officialAddress.provinceId,
        districtId: officialAddress.districtId,
        localLevelId: officialAddress.localLevelId,
        wardNumber: officialAddress.wardNumber,
        streetAddress: officialAddress.streetAddress || "",
        houseNumber: officialAddress.houseNumber || "",
      }
    : null;
  const [newProgram, setNewProgram] = useState({ name: "", description: "" });
  const [newNews, setNewNews] = useState({ title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", email: "", password: "", schoolGradeId: "", sectionId: "" });
  const [addingStudent, setAddingStudent] = useState(false);
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: "", email: "", password: "", position: "Teacher", subjects: "" });
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [changingSectionFor, setChangingSectionFor] = useState<string | null>(null);
  const [sectionPick, setSectionPick] = useState<Record<string, string>>({});
  const [assigningPlacementFor, setAssigningPlacementFor] = useState<string | null>(null);
  const [placementPick, setPlacementPick] = useState<Record<string, { schoolGradeId: string; sectionId: string }>>({});
  const [assigningPlacement, setAssigningPlacement] = useState(false);

  const pendingStaff = school.teachers.filter((x) => !x.approved).length;
  const pendingStudents = school.students.filter((x) => !x.approved).length;
  const pendingTotal = pendingStaff + pendingStudents;

  const heroCards: HeroCard[] = [];
  if (pendingTotal > 0) {
    heroCards.push({
      icon: "✅",
      title: `${pendingTotal} waiting for approval`,
      description: `${pendingStaff} staff, ${pendingStudents} students ready for review.`,
      onClick: () => setTab(pendingStaff > 0 ? "staff" : "students"),
      cta: "Review now",
      accent: "gold",
    });
  }
  if (!school.verified) {
    heroCards.push({
      icon: "⏳",
      title: "Your school is pending verification",
      description: "A Platform Admin needs to verify you before you're public.",
      onClick: () => setTab("profile"),
      cta: "View profile",
      accent: "gold",
    });
  }
  heroCards.push({
    icon: "📚",
    title: "Academic Sessions & Grades",
    description: "Set up grades and sessions, then promote students grade by grade.",
    href: "/dashboard/grades",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "🧮",
    title: "Subjects & Teacher Assignments",
    description: "Manage your subject catalog and assign teachers to grades, sections, and subjects.",
    href: "/dashboard/academics",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "🧾",
    title: "Assessment Frameworks",
    description: "Define grading scales and marking schemes, then assign them to grades or subjects.",
    href: "/dashboard/assessment-frameworks",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "📊",
    title: "Assessment Results",
    description: "Enter, correct, and publish student results for any subject this session.",
    href: "/dashboard/assessment-results",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "✅",
    title: "Attendance",
    description: "Take or review daily attendance for any grade and section.",
    href: "/dashboard/attendance",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "📝",
    title: "Student Evaluations",
    description: "General development remarks and subject-specific evaluations for any student.",
    href: "/dashboard/evaluations",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "🗓️",
    title: "Parent-Teacher Meetings",
    description: "See and manage every meeting at your school — filter by teacher, status, or upcoming/past.",
    href: "/dashboard/meetings",
    cta: "Open",
    accent: "purple",
  });
  heroCards.push({
    icon: "📢",
    title: "Post an opportunity",
    description: "Scholarships, competitions, or events for your students.",
    onClick: () => setTab("opportunities"),
    cta: "Post now",
    accent: "purple",
  });
  heroCards.push({
    icon: "🎓",
    title: "Browse MEGA Academy",
    description: "See what courses are available for your staff and students.",
    href: "/courses",
    cta: "Explore courses",
    accent: "navy",
  });

  async function saveProfile() {
    setSaving(true);
    await fetch(`/api/schools/${school.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    router.refresh();
  }

  async function saveOfficialAddress(value: AddressFormValue): Promise<string | null> {
    const res = await fetch(`/api/schools/${school.id}/address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Something went wrong.";
    router.refresh();
    return null;
  }

  async function addProgram() {
    if (!newProgram.name.trim()) return;
    await fetch(`/api/schools/${school.id}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProgram),
    });
    setNewProgram({ name: "", description: "" });
    router.refresh();
  }

  async function addNews() {
    if (!newNews.title.trim()) return;
    await fetch(`/api/schools/${school.id}/news`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newNews),
    });
    setNewNews({ title: "", body: "" });
    router.refresh();
  }

  async function approveTeacher(teacherId: string) {
    await fetch(`/api/schools/${school.id}/teachers/${teacherId}/approve`, { method: "POST" });
    router.refresh();
  }

  async function approveStudent(studentId: string) {
    await fetch(`/api/schools/${school.id}/students/${studentId}/approve`, { method: "POST" });
    router.refresh();
  }

  async function addStudent() {
    setError(null);
    if (!newStudent.name.trim() || !newStudent.email.trim() || newStudent.password.length < 8) {
      setError("Enter a name, email, and a password of at least 8 characters.");
      return;
    }
    setAddingStudent(true);
    const res = await fetch(`/api/schools/${school.id}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newStudent.name.trim(),
        email: newStudent.email.trim(),
        password: newStudent.password,
        ...(newStudent.schoolGradeId && activeSession
          ? {
              academicSessionId: activeSession.id,
              schoolGradeId: newStudent.schoolGradeId,
              ...(newStudent.sectionId ? { sectionId: newStudent.sectionId } : {}),
            }
          : {}),
      }),
    });
    const body = await res.json();
    setAddingStudent(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setNewStudent({ name: "", email: "", password: "", schoolGradeId: "", sectionId: "" });
    setShowAddStudent(false);
    router.refresh();
  }

  async function addTeacher() {
    setError(null);
    if (!newTeacher.name.trim() || !newTeacher.email.trim() || newTeacher.password.length < 8) {
      setError("Enter a name, email, and a password of at least 8 characters.");
      return;
    }
    setAddingTeacher(true);
    const res = await fetch(`/api/schools/${school.id}/teachers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTeacher.name.trim(),
        email: newTeacher.email.trim(),
        password: newTeacher.password,
        position: newTeacher.position,
        subjects: newTeacher.subjects.trim() || undefined,
      }),
    });
    const body = await res.json();
    setAddingTeacher(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setNewTeacher({ name: "", email: "", password: "", position: "Teacher", subjects: "" });
    setShowAddTeacher(false);
    router.refresh();
  }

  async function changeSection(studentId: string, gradeHistoryId: string) {
    setError(null);
    const sectionId = sectionPick[studentId] ?? "";
    const res = await fetch(`/api/schools/${school.id}/section-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gradeHistoryIds: [gradeHistoryId], sectionId: sectionId || null }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setChangingSectionFor(null);
    router.refresh();
  }

  async function assignPlacement(studentId: string) {
    setError(null);
    if (!activeSession) return;
    const pick = placementPick[studentId];
    if (!pick?.schoolGradeId) {
      setError("Select a grade to assign.");
      return;
    }
    setAssigningPlacement(true);
    const res = await fetch(`/api/schools/${school.id}/grade-placements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academicSessionId: activeSession.id,
        placements: [
          { studentId, schoolGradeId: pick.schoolGradeId, sectionId: pick.sectionId || undefined },
        ],
      }),
    });
    const body = await res.json();
    setAssigningPlacement(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    if (!body.created) {
      setError("Couldn't place this student — check the grade/section selection.");
      return;
    }
    setAssigningPlacementFor(null);
    router.refresh();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={`Here's what's new at ${school.name}.`}
        cards={heroCards.slice(0, 3)}
        avatar={{ url: school.logoUrl, label: school.name, variant: "school" }}
      />

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-800">{school.name}</h1>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            school.verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {school.verified ? "Verified" : "Pending Verification"}
        </span>
      </div>
      <p className="text-slate-500 mb-8">
        <a href={`/schools/${school.slug}`} className="text-mega-blue hover:underline">
          View public profile →
        </a>
      </p>

      <div className="flex gap-1 border-b border-slate-200 mb-8 flex-wrap">
        {(["profile", "programs", "news", "opportunities", "staff", "students", "finance"] as const).map((t) => {
          const pendingCount =
            t === "staff"
              ? school.teachers.filter((x) => !x.approved).length
              : t === "students"
              ? school.students.filter((x) => !x.approved).length
              : 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition flex items-center gap-1.5 ${
                tab === t
                  ? "border-mega-navy text-mega-navy"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
              {pendingCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-semibold rounded-full px-2 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "profile" && (
        <div className="space-y-4 max-w-lg">
          <SchoolLogoManager schoolId={school.id} schoolName={school.name} logoUrl={school.logoUrl} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact email</label>
              <input
                value={profile.contactEmail}
                onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact phone</label>
              <input
                value={profile.contactPhone}
                onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grades offered</label>
              <input
                value={profile.gradesOffered}
                onChange={(e) => setProfile({ ...profile, gradesOffered: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
            </div>
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <div className="mt-6">
            <AddressCard
              title="Official School Address"
              description="The school's structured, official address on record — Province, District, Local Level, and Ward. The Location field above stays as a free-text summary; this is the authoritative, verifiable version of it."
              initialValue={officialAddressValue}
              onSave={saveOfficialAddress}
            />
          </div>
        </div>
      )}

      {tab === "programs" && (
        <div className="space-y-6 max-w-lg">
          <div className="space-y-3">
            {school.programs.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-800">{p.name}</p>
                {p.description && <p className="text-sm text-slate-500">{p.description}</p>}
              </div>
            ))}
            {school.programs.length === 0 && (
              <p className="text-slate-400 text-sm">No programs added yet.</p>
            )}
          </div>
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Add a program</p>
            <input
              placeholder="Program name"
              value={newProgram.name}
              onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <textarea
              placeholder="Description (optional)"
              value={newProgram.description}
              onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <button
              onClick={addProgram}
              className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm"
            >
              Add Program
            </button>
          </div>
        </div>
      )}

      {tab === "news" && (
        <div className="space-y-6 max-w-lg">
          <div className="space-y-3">
            {school.news.map((n) => (
              <div key={n.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-800">{n.title}</p>
                <p className="text-sm text-slate-500">{n.body}</p>
              </div>
            ))}
            {school.news.length === 0 && (
              <p className="text-slate-400 text-sm">No news posted yet.</p>
            )}
          </div>
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Post news</p>
            <input
              placeholder="Title"
              value={newNews.title}
              onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <textarea
              placeholder="Body"
              value={newNews.body}
              onChange={(e) => setNewNews({ ...newNews, body: e.target.value })}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
            <button
              onClick={addNews}
              className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm"
            >
              Post
            </button>
          </div>
        </div>
      )}

      {tab === "opportunities" && (
        <OpportunityPoster
          postEndpoint={`/api/schools/${school.id}/opportunities`}
          opportunities={school.opportunities}
        />
      )}

      {tab === "staff" && (
        <div className="space-y-3 max-w-lg">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddTeacher((v) => !v)}
              className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
            >
              {showAddTeacher ? "Cancel" : "+ Add Teacher"}
            </button>
          </div>

          {showAddTeacher && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Add a teacher/staff member directly</p>
              <p className="text-xs text-slate-400">
                For staff who can't register themselves. They're approved immediately — share
                these login details with them directly.
              </p>
              <input
                placeholder="Full name"
                value={newTeacher.name}
                onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <input
                placeholder="Email"
                type="email"
                value={newTeacher.email}
                onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Temporary password (min 8 characters)"
                  type={showTeacherPassword ? "text" : "password"}
                  value={newTeacher.password}
                  onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword((v) => !v)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2"
                >
                  {showTeacherPassword ? "Hide" : "Show"}
                </button>
              </div>
              <select
                value={newTeacher.position}
                onChange={(e) => setNewTeacher({ ...newTeacher, position: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              >
                {["Teacher", "Librarian", "Counselor", "Coach", "Administrative Staff", "Nurse", "Other"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                placeholder="Subjects (optional, free text)"
                value={newTeacher.subjects}
                onChange={(e) => setNewTeacher({ ...newTeacher, subjects: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <button
                onClick={addTeacher}
                disabled={addingTeacher}
                className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm disabled:opacity-50"
              >
                {addingTeacher ? "Adding..." : "Add Teacher"}
              </button>
            </div>
          )}

          {school.teachers.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No teachers have requested to join yet. Share your school&apos;s
              name with staff so they can register — or add one directly above.
            </p>
          ) : (
            school.teachers.map((t) => (
              <div key={t.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{t.user.name}</p>
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                        {t.position}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {t.user.email}
                      {t.subjects ? ` · ${t.subjects}` : ""}
                    </p>
                  </div>
                  {t.approved ? (
                    <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-3 py-1">
                      Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => approveTeacher(t.id)}
                      className="bg-mega-green text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:brightness-95 transition"
                    >
                      Approve
                    </button>
                  )}
                </div>
                {t.approved && (
                  <Link href={`/dashboard/teachers/${t.id}`} className="text-xs text-mega-blue font-medium">
                    View Profile →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "students" && (
        <div className="space-y-3 max-w-lg">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddStudent((v) => !v)}
              className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
            >
              {showAddStudent ? "Cancel" : "+ Add Student"}
            </button>
          </div>

          {showAddStudent && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Add a student directly</p>
              <p className="text-xs text-slate-400">
                For students who can't register themselves. They're approved immediately —
                share these login details with the family directly.
              </p>
              <input
                placeholder="Full name"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <input
                placeholder="Email"
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Temporary password (min 8 characters)"
                  type={showStudentPassword ? "text" : "password"}
                  value={newStudent.password}
                  onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowStudentPassword((v) => !v)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2"
                >
                  {showStudentPassword ? "Hide" : "Show"}
                </button>
              </div>
              {activeSession ? (
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newStudent.schoolGradeId}
                    onChange={(e) => setNewStudent({ ...newStudent, schoolGradeId: e.target.value, sectionId: "" })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                  >
                    <option value="">Grade (optional)</option>
                    {schoolGrades.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.displayName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newStudent.sectionId}
                    onChange={(e) => setNewStudent({ ...newStudent, sectionId: e.target.value })}
                    disabled={!newStudent.schoolGradeId}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">No section</option>
                    {(schoolGrades.find((g) => g.id === newStudent.schoolGradeId)?.sections || []).map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Section {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No active academic session yet — this student will be created without a grade
                  placement. Complete{" "}
                  <a href="/dashboard/setup" className="underline font-medium">
                    Initial Setup
                  </a>{" "}
                  first to place students into grades.
                </p>
              )}
              <button
                onClick={addStudent}
                disabled={addingStudent}
                className="bg-mega-navy text-white font-semibold px-5 py-2 rounded-full hover:bg-mega-blue transition text-sm disabled:opacity-50"
              >
                {addingStudent ? "Adding..." : "Add Student"}
              </button>
            </div>
          )}

          {school.students.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No students have requested to join yet. Add one directly above.
            </p>
          ) : (
            school.students.map((s) => (
              <div key={s.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{s.user.name}</p>
                    <p className="text-sm text-slate-500">
                      {s.user.email}
                      {s.placement
                        ? ` · ${s.placement.gradeDisplayName}${s.placement.sectionName ? ` — Section ${s.placement.sectionName}` : ""}`
                        : s.gradeLevel
                        ? ` · ${s.gradeLevel}`
                        : ""}
                    </p>
                  </div>
                  {s.approved ? (
                    <span className="text-xs font-semibold bg-green-100 text-green-700 rounded-full px-3 py-1">
                      Approved
                    </span>
                  ) : (
                    <button
                      onClick={() => approveStudent(s.id)}
                      className="bg-mega-green text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:brightness-95 transition"
                    >
                      Approve
                    </button>
                  )}
                </div>

                {s.approved && (
                  <Link href={`/dashboard/students/${s.id}`} className="text-xs text-mega-blue font-medium">
                    View Profile →
                  </Link>
                )}

                {s.approved && s.placement && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {changingSectionFor === s.id ? (
                      <div className="flex gap-2">
                        <select
                          value={sectionPick[s.id] ?? (s.placement.sectionId || "")}
                          onChange={(e) => setSectionPick((p) => ({ ...p, [s.id]: e.target.value }))}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                        >
                          <option value="">No section</option>
                          {(schoolGrades.find((g) => g.id === s.placement!.schoolGradeId)?.sections || []).map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              Section {sec.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => changeSection(s.id, s.placement!.gradeHistoryId)}
                          className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setChangingSectionFor(null)}
                          className="text-xs text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setChangingSectionFor(s.id)}
                        className="text-xs text-mega-blue font-medium"
                      >
                        Change Section →
                      </button>
                    )}
                  </div>
                )}

                {s.approved && !s.placement && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    {!activeSession ? (
                      <p className="text-xs text-amber-700">
                        No active academic session yet — complete{" "}
                        <a href="/dashboard/setup" className="underline font-medium">
                          Initial Setup
                        </a>{" "}
                        to assign a grade.
                      </p>
                    ) : assigningPlacementFor === s.id ? (
                      <div className="flex gap-2">
                        <select
                          value={placementPick[s.id]?.schoolGradeId ?? ""}
                          onChange={(e) =>
                            setPlacementPick((p) => ({
                              ...p,
                              [s.id]: { schoolGradeId: e.target.value, sectionId: "" },
                            }))
                          }
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
                        >
                          <option value="">Grade</option>
                          {schoolGrades.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.displayName}
                            </option>
                          ))}
                        </select>
                        <select
                          value={placementPick[s.id]?.sectionId ?? ""}
                          onChange={(e) =>
                            setPlacementPick((p) => ({
                              ...p,
                              [s.id]: { schoolGradeId: p[s.id]?.schoolGradeId ?? "", sectionId: e.target.value },
                            }))
                          }
                          disabled={!placementPick[s.id]?.schoolGradeId}
                          className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">No section</option>
                          {(schoolGrades.find((g) => g.id === placementPick[s.id]?.schoolGradeId)?.sections || []).map(
                            (sec) => (
                              <option key={sec.id} value={sec.id}>
                                Section {sec.name}
                              </option>
                            )
                          )}
                        </select>
                        <button
                          onClick={() => assignPlacement(s.id)}
                          disabled={assigningPlacement}
                          className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-3 py-1.5 disabled:opacity-50"
                        >
                          {assigningPlacement ? "Assigning..." : "Assign"}
                        </button>
                        <button
                          onClick={() => setAssigningPlacementFor(null)}
                          className="text-xs text-slate-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningPlacementFor(s.id)}
                        className="text-xs text-mega-blue font-medium"
                      >
                        Assign Grade & Section →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "finance" && (
        <div className="max-w-lg">
          <AccountantGrantForm grantEndpoint={`/api/schools/${school.id}/accountants`} accountants={school.accountants} />
        </div>
      )}
    </div>
  );
}
