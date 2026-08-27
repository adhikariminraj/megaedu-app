"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardHero from "@/components/DashboardHero";

export default function CreateOrgPrompt({ userName }: { userName: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ orgName: "", description: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.orgName.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/organizations/create-for-admin", {
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
        subtitle="One more step — create your organization's profile to get started."
        cards={[]}
      />

      <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Create Your Organization</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Organization name</label>
          <input
            required
            value={form.orgName}
            onChange={(e) => setForm({ ...form, orgName: e.target.value })}
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
          <input
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            placeholder="https://..."
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
        </div>
        {error && <p className="text-sm text-mega-red">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Organization Profile"}
        </button>
      </form>
    </div>
  );
}
