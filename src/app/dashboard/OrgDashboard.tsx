"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OpportunityPoster from "@/components/OpportunityPoster";
import AccountantGrantForm from "@/components/AccountantGrantForm";
import DashboardHero, { HeroCard } from "@/components/DashboardHero";

type Organization = {
  id: string;
  name: string;
  verified: boolean;
  courses: {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    priceCents: number;
    approach: { name: string } | null;
  }[];
  opportunities: { id: string; title: string; type: string; deadline: string | Date | null }[];
  accountants: { user: { name: string; email: string } }[];
};

export default function OrgDashboard({ organization, userName }: { organization: Organization; userName: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"courses" | "opportunities" | "finance">("courses");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", instructorName: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/organizations/${organization.id}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    router.push(`/dashboard/courses/${data.course.id}/manage`);
  }

  const publishedCount = organization.courses.filter((c) => c.published).length;

  const heroCards: HeroCard[] = [];
  if (!organization.verified) {
    heroCards.push({
      icon: "⏳",
      title: "Pending verification",
      description: "A Platform Admin needs to verify you before courses go live. No action needed on your end.",
      accent: "gold",
    });
  }
  heroCards.push({
    icon: "➕",
    title: "Create a new course",
    description: `You have ${publishedCount} published so far.`,
    onClick: () => { setTab("courses"); setShowForm(true); },
    cta: "Start a course",
    accent: "navy",
  });
  heroCards.push({
    icon: "📢",
    title: "Post an opportunity",
    description: "Scholarships, competitions, or jobs for the network.",
    onClick: () => setTab("opportunities"),
    cta: "Post now",
    accent: "purple",
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle={`${organization.name} — ${organization.verified ? "verified" : "pending verification"}.`}
        cards={heroCards.slice(0, 3)}
      />

      <div className="flex gap-1 border-b border-slate-200 mb-8">
        {(["courses", "opportunities", "finance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition ${
              tab === t
                ? "border-mega-navy text-mega-navy"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Your Courses</h2>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition"
            >
              {showForm ? "Cancel" : "+ New Course"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={createCourse} className="border border-slate-200 rounded-xl p-5 mb-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Course title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Instructor name (optional)
                </label>
                <input
                  value={form.instructorName}
                  onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
                  placeholder="Who teaches this course? No MEGA ID required."
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Shown on certificates issued for this course. If they later
                  get a MEGA ID, their record can be linked to it.
                </p>
              </div>
              {error && <p className="text-sm text-mega-red">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-mega-green text-white font-semibold px-5 py-2 rounded-full hover:brightness-95 transition text-sm disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Course & Add Content"}
              </button>
              <p className="text-xs text-slate-400">
                Free by default. You can add modules and lessons on the next
                screen, then publish when ready.
              </p>
            </form>
          )}

          {organization.courses.length === 0 ? (
            <p className="text-slate-400 text-sm">No courses yet.</p>
          ) : (
            <div className="space-y-3">
              {organization.courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/courses/${c.id}/manage`}
                  className="flex items-center justify-between border border-slate-200 rounded-xl p-4 hover:shadow-md transition"
                >
                  <div>
                    <p className="font-medium text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      {c.priceCents === 0 ? "Free" : `NPR ${(c.priceCents / 100).toFixed(0)}`}
                      {c.approach ? ` · ${c.approach.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      c.published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {c.published ? "Published" : "Draft"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "opportunities" && (
        <OpportunityPoster
          postEndpoint={`/api/organizations/${organization.id}/opportunities`}
          opportunities={organization.opportunities}
        />
      )}

      {tab === "finance" && (
        <AccountantGrantForm
          grantEndpoint={`/api/organizations/${organization.id}/accountants`}
          accountants={organization.accountants}
        />
      )}
    </div>
  );
}
