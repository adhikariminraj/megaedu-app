"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * School Admin's small "Edit Student Information" control for the two
 * Phase 2 identity fields — Date of Birth and Student ID (admission
 * number). Collapsed by default (a plain "Edit" toggle), not a
 * permanently-open form, per the approved UX decision to keep the
 * identity block visually recognizable rather than making it look like
 * a form by default.
 *
 * Presented together as one small interaction, but writes two
 * independently-scoped routes under the hood — dateOfBirth to
 * PATCH .../students/[studentId] (a Student-level field), admissionNumber
 * to PATCH .../students/[studentId]/affiliation (the current OPEN
 * StudentSchoolAffiliation at this school). Never a single combined
 * "update anything" endpoint. Both requests fire on Save; either can
 * fail independently, and both errors are shown if both do.
 */
export default function EditStudentInfoForm({
  schoolId,
  studentId,
  initialAdmissionNumber,
  initialDateOfBirth,
}: {
  schoolId: string;
  studentId: string;
  initialAdmissionNumber: string | null;
  initialDateOfBirth: string | null; // "YYYY-MM-DD" | null
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState(initialAdmissionNumber ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setAdmissionNumber(initialAdmissionNumber ?? "");
    setDateOfBirth(initialDateOfBirth ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const [affiliationRes, studentRes] = await Promise.all([
      fetch(`/api/schools/${schoolId}/students/${studentId}/affiliation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admissionNumber }),
      }),
      fetch(`/api/schools/${schoolId}/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth: dateOfBirth || null }),
      }),
    ]);

    const errors: string[] = [];
    if (!affiliationRes.ok) {
      const body = await affiliationRes.json().catch(() => ({}));
      errors.push(body.error || "Could not save Student ID.");
    }
    if (!studentRes.ok) {
      const body = await studentRes.json().catch(() => ({}));
      errors.push(body.error || "Could not save Date of Birth.");
    }

    setSaving(false);
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button onClick={startEditing} className="text-xs text-mega-blue font-medium">
        Edit Student Information →
      </button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl p-4 mt-2 max-w-sm">
      <div className="mb-3">
        <label className="text-xs font-semibold text-slate-500 block mb-1">Student ID</label>
        <input
          value={admissionNumber}
          onChange={(e) => setAdmissionNumber(e.target.value)}
          placeholder="e.g. HSS-0087"
          maxLength={50}
          disabled={saving}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
      </div>
      <div className="mb-3">
        <label className="text-xs font-semibold text-slate-500 block mb-1">Date of Birth</label>
        <input
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          disabled={saving}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
      </div>
      {error && <p className="text-xs text-mega-red mb-3">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="text-xs font-semibold text-white bg-mega-navy rounded-full px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="text-xs font-semibold text-slate-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
