"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHero from "@/components/DashboardHero";

export default function CreateSchoolPrompt({ userName }: { userName: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ schoolName: "", location: "", gradesOffered: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.schoolName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/schools/create-for-admin", {
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
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <DashboardHero
        name={userName}
        subtitle="One more step — create your school's profile to get started."
        cards={[]}
      />

      <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Create Your School</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">School name</label>
          <input
            required
            value={form.schoolName}
            onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Kathmandu"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Grades offered</label>
            <input
              value={form.gradesOffered}
              onChange={(e) => setForm({ ...form, gradesOffered: e.target.value })}
              placeholder="e.g. 1-10"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
            />
          </div>
        </div>
        {error && <p className="text-sm text-mega-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create School Profile"}
        </button>
      </form>
    </div>
  );
}
