"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Interest = { id: string; name: string };

export default function InterestManager({
  interests,
  locked = false,
}: {
  interests: Interest[];
  locked?: boolean;
}) {
  const router = useRouter();
  const [newInterest, setNewInterest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addInterest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const names = newInterest
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;

    setLoading(true);
    // One request for the whole comma-separated batch — so "add three
    // interests at once" counts as a single session change, not three.
    const res = await fetch("/api/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    setNewInterest("");
    router.refresh();
  }

  async function removeInterest(id: string) {
    setError(null);
    const res = await fetch(`/api/interests/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Interests & Instincts</h3>
      <p className="text-xs text-slate-400 mb-4">
        Your own personal interests — separate from Skills, which your teachers
        add.{" "}
        {locked
          ? "You've already changed these this academic session — you'll be able to change them again once the next session starts."
          : "You can change these once per academic session; further changes will wait until the next session starts."}
      </p>

      {error && <p className="text-xs text-mega-red mb-3">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {interests.length === 0 && (
          <p className="text-sm text-slate-400">No interests added yet.</p>
        )}
        {interests.map((i) => (
          <span
            key={i.id}
            className="inline-flex items-center gap-1.5 text-sm bg-amber-50 text-mega-gold font-medium rounded-full pl-3 pr-2 py-1"
          >
            {i.name}
            {!locked && (
              <button
                onClick={() => removeInterest(i.id)}
                className="text-mega-gold hover:text-red-600 text-xs"
                aria-label={`Remove ${i.name}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>

      {!locked && (
        <form onSubmit={addInterest} className="flex gap-2">
          <input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            placeholder="e.g. Music, Robotics, Sports (comma-separated for multiple)"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mega-blue"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-mega-navy text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
