"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OpportunityPoster from "@/components/OpportunityPoster";
import AccountantGrantForm from "@/components/AccountantGrantForm";
import DashboardHero, { HeroCard } from "@/components/DashboardHero";

type School = {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
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
  }[];
  accountants: { user: { name: string; email: string } }[];
};

export default function DashboardClient({ school, userName }: { school: School; userName: string }) {
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
  const [newProgram, setNewProgram] = useState({ name: "", description: "" });
  const [newNews, setNewNews] = useState({ title: "", body: "" });

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={`Here's what's new at ${school.name}.`}
        cards={heroCards.slice(0, 3)}
      />

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
          {school.teachers.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No teachers have requested to join yet. Share your school&apos;s
              name with staff so they can register.
            </p>
          ) : (
            school.teachers.map((t) => (
              <div
                key={t.id}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
              >
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
            ))
          )}
        </div>
      )}

      {tab === "students" && (
        <div className="space-y-3 max-w-lg">
          {school.students.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No students have requested to join yet.
            </p>
          ) : (
            school.students.map((s) => (
              <div
                key={s.id}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-800">{s.user.name}</p>
                  <p className="text-sm text-slate-500">
                    {s.user.email}
                    {s.gradeLevel ? ` · ${s.gradeLevel}` : ""}
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
