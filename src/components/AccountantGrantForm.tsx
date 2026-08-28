"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Accountant = { user: { name: string; email: string } };

export default function AccountantGrantForm({
  grantEndpoint,
  accountants,
}: {
  grantEndpoint: string;
  accountants: Accountant[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch(grantEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setEmail("");
    router.refresh();
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Finance Access (Accountant)</h2>
      <p className="text-xs text-slate-400 mb-4">
        Grant an existing MEGA ID finance-only access — they will not gain
        any admin, academic, or student-management permissions.
      </p>

      {accountants.length > 0 && (
        <div className="space-y-2 mb-4">
          {accountants.map((a, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 text-sm">
              <span className="font-medium text-slate-800">{a.user.name}</span>{" "}
              <span className="text-slate-400">{a.user.email}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Their MEGA ID email"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
        >
          {loading ? "Granting..." : "Grant Access"}
        </button>
      </form>
      {error && <p className="text-xs text-mega-red mt-2">{error}</p>}
    </div>
  );
}
