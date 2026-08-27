"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opportunity = {
  id: string;
  title: string;
  type: string;
  deadline: string | Date | null;
};

const TYPES = ["Scholarship", "Competition", "Event", "Job", "Other"];

export default function OpportunityPoster({
  postEndpoint,
  opportunities,
}: {
  postEndpoint: string;
  opportunities: Opportunity[];
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Scholarship",
    deadline: "",
    applyUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(postEndpoint, {
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
    setForm({ title: "", description: "", type: "Scholarship", deadline: "", applyUrl: "" });
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Opportunities Posted</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition"
        >
          {showForm ? "Cancel" : "+ Post Opportunity"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <input
            required
            placeholder="Title (e.g. National Science Scholarship 2026)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <input
            placeholder="Link to apply / learn more (optional)"
            value={form.applyUrl}
            onChange={(e) => setForm({ ...form, applyUrl: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          {error && <p className="text-sm text-mega-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Opportunity"}
          </button>
        </form>
      )}

      {opportunities.length === 0 ? (
        <p className="text-slate-400 text-sm">Nothing posted yet.</p>
      ) : (
        <div className="space-y-2">
          {opportunities.map((o) => (
            <div key={o.id} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{o.title}</span>
              <span className="text-xs text-slate-400">
                {o.type}
                {o.deadline ? ` · Deadline ${new Date(o.deadline).toLocaleDateString()}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
