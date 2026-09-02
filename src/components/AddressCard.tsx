"use client";

import { useState } from "react";
import AddressForm, { AddressFormValue, EMPTY_ADDRESS } from "./AddressForm";

/**
 * One labeled address (e.g. "Current Address", "Official School
 * Address") wrapped in its own card with its own Save button — the
 * reusable unit every page that manages an Address builds on, so the
 * save/error/success handling around AddressForm exists exactly once.
 *
 * `onSave` does the actual persistence (each caller knows its own API
 * route and owner) and returns an error message, or null on success.
 * `readOnly` renders the same fields disabled with no Save button, for
 * viewers who can see but not correct a record (e.g. a Teacher browsing
 * a Student's file, per the school-admin-only correction rule).
 */
export default function AddressCard({
  title,
  description,
  initialValue,
  onSave,
  readOnly,
}: {
  title: string;
  description?: string;
  initialValue: AddressFormValue | null;
  onSave?: (value: AddressFormValue) => Promise<string | null>;
  readOnly?: boolean;
}) {
  const [value, setValue] = useState<AddressFormValue>(initialValue || EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const err = await onSave(value);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      {description && <p className="text-xs text-slate-400 mb-4">{description}</p>}
      {readOnly && !initialValue ? (
        <p className="text-sm text-slate-400">Not on file yet.</p>
      ) : (
        <>
          <AddressForm value={value} onChange={setValue} disabled={readOnly || saving} />
          {!readOnly && (
            <>
              {error && <p className="text-xs text-mega-red mt-3">{error}</p>}
              {saved && !error && <p className="text-xs text-mega-green mt-3">Saved.</p>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 bg-mega-navy text-white font-semibold px-6 py-2.5 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
