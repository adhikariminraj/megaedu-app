"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkChildPrompt() {
  const router = useRouter();
  const [childEmail, setChildEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!childEmail.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/parent/link-child", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childEmail }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setChildEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-slate-800">Link Your Child</h2>
      <p className="text-sm text-slate-500">
        Your child needs a MEGA.EDU student account already — enter the
        email they used to register as a student.
      </p>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Your child&apos;s email
        </label>
        <input
          required
          type="email"
          value={childEmail}
          onChange={(e) => setChildEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>
      {error && (
        <p className="text-sm text-mega-red bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="bg-mega-red text-white font-semibold px-6 py-2.5 rounded-full hover:brightness-95 transition disabled:opacity-50"
      >
        {loading ? "Linking..." : "Link Child"}
      </button>
    </form>
  );
}
