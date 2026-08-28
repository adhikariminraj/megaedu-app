"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Interest = { id: string; name: string };

export default function InterestManager({ interests }: { interests: Interest[] }) {
  const router = useRouter();
  const [newInterest, setNewInterest] = useState("");
  const [loading, setLoading] = useState(false);

  async function addInterest(e: React.FormEvent) {
    e.preventDefault();
    const names = newInterest
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;

    setLoading(true);
    // Submit each comma-separated entry as its own separate tag, rather
    // than storing "Football, Music" as one literal interest name.
    for (const name of names) {
      await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    setNewInterest("");
    setLoading(false);
    router.refresh();
  }

  async function removeInterest(id: string) {
    await fetch(`/api/interests/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">Interests & Instincts</h3>
      <p className="text-xs text-slate-400 mb-4">
        Your own personal interests — separate from Skills, which your
        teachers add. Freely editable for now; once academic sessions
        launch, changes will apply from the start of the next session.
      </p>

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
            <button
              onClick={() => removeInterest(i.id)}
              className="text-mega-gold hover:text-red-600 text-xs"
              aria-label={`Remove ${i.name}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>

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
    </div>
  );
}
