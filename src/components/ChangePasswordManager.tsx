"use client";

import { useState } from "react";

/**
 * Self-service password change for the currently authenticated MEGA ID
 * — mirrors AddressCard's exact save/error/success shape (same
 * text-mega-red / text-mega-green convention, same "Saved."-style terse
 * copy). Confirmation-mismatch is checked here only — there is nothing
 * for the server to compare a "confirm" value against besides the
 * single newPassword it receives, so only currentPassword/newPassword
 * are ever sent.
 */
export default function ChangePasswordManager() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/user/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-mega-blue"
        />
      </div>

      {error && <p className="text-xs text-mega-red">{error}</p>}
      {saved && !error && <p className="text-xs text-mega-green">Password changed.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
      >
        {saving ? "Changing..." : "Change Password"}
      </button>
    </form>
  );
}
