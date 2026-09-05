"use client";

import { useState } from "react";

export default function InquiryForm({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/schools/${schoolId}/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      const fieldError =
        data.error?.fieldErrors &&
        Object.values(data.error.fieldErrors as Record<string, string[]>).flat()[0];
      setError(fieldError || data.error?.formErrors?.[0] || data.error || "Something went wrong.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
        <p className="text-green-800 font-medium">
          Thank you. Your inquiry has been submitted to {schoolName}.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
        <input
          required
          maxLength={150}
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          required
          type="email"
          maxLength={254}
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Phone <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          maxLength={30}
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
        <textarea
          required
          rows={5}
          maxLength={4000}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>

      {/* Honeypot — hidden from real visitors via CSS (not just visually
          hidden with a screen-reader label, which some bots skip), never
          rendered as a normal field. Left empty by any real person. */}
      <div aria-hidden="true" className="absolute -left-[9999px]" style={{ opacity: 0 }}>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
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
        className="w-full bg-mega-navy text-white font-semibold py-3 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send Inquiry"}
      </button>
    </form>
  );
}
