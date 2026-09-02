"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressCard from "@/components/AddressCard";
import { AddressFormValue } from "@/components/AddressForm";

const RELATIONSHIP_OPTIONS = [
  { value: "FATHER", label: "Father" },
  { value: "MOTHER", label: "Mother" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "GRANDFATHER", label: "Grandfather" },
  { value: "GRANDMOTHER", label: "Grandmother" },
  { value: "BROTHER", label: "Brother" },
  { value: "SISTER", label: "Sister" },
  { value: "UNCLE", label: "Uncle" },
  { value: "AUNT", label: "Aunt" },
  { value: "OTHER", label: "Other" },
] as const;

function relationshipLabel(relationship: string, relationshipOther: string | null) {
  if (relationship === "OTHER") return relationshipOther || "Other";
  return RELATIONSHIP_OPTIONS.find((r) => r.value === relationship)?.label || relationship;
}

export type FamilyContactData = {
  id: string;
  fullName: string;
  relationship: string;
  relationshipOther: string | null;
  mobileNumber: string | null;
  isPrimaryContact: boolean;
  isGuardian: boolean;
  isEmergencyContact: boolean;
  isActive: boolean;
  address: AddressFormValue | null;
};

type ContactFormState = {
  fullName: string;
  relationship: string;
  relationshipOther: string;
  mobileNumber: string;
  isPrimaryContact: boolean;
  isGuardian: boolean;
  isEmergencyContact: boolean;
};

const BLANK_FORM: ContactFormState = {
  fullName: "",
  relationship: "FATHER",
  relationshipOther: "",
  mobileNumber: "",
  isPrimaryContact: false,
  isGuardian: false,
  isEmergencyContact: false,
};

function toFormState(c: FamilyContactData): ContactFormState {
  return {
    fullName: c.fullName,
    relationship: c.relationship,
    relationshipOther: c.relationshipOther || "",
    mobileNumber: c.mobileNumber || "",
    isPrimaryContact: c.isPrimaryContact,
    isGuardian: c.isGuardian,
    isEmergencyContact: c.isEmergencyContact,
  };
}

/**
 * School Admin's Family & Emergency Contacts editor for one Student —
 * administrative records only, deliberately unrelated to
 * Parent/ParentStudent/MEGA ID (see the FamilyContact model comment in
 * schema.prisma). Only one contact may hold Primary Contact at a time;
 * the server enforces this, this UI just reflects the result.
 *
 * Follows the exact inline-edit / two-step-confirm-deactivate pattern
 * already established for Sections (AcademicStructureClient.tsx) —
 * never a hard delete, always Active/Inactive.
 */
export default function FamilyContactsManager({
  baseUrl,
  contacts,
}: {
  baseUrl: string;
  contacts: FamilyContactData[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState<ContactFormState>(BLANK_FORM);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ContactFormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);

  async function call(url: string, options: RequestInit) {
    setError(null);
    const res = await fetch(url, options);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return null;
    }
    router.refresh();
    return body;
  }

  async function addContact() {
    if (!newContact.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    setAdding(true);
    const result = await call(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newContact),
    });
    setAdding(false);
    if (result) {
      setNewContact(BLANK_FORM);
      setShowAddForm(false);
    }
  }

  async function saveEdit(contactId: string) {
    setSaving(true);
    const result = await call(`${baseUrl}/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editDraft),
    });
    setSaving(false);
    if (result) setEditingId(null);
  }

  async function toggleActive(c: FamilyContactData) {
    await call(`${baseUrl}/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    setConfirmDeactivateId(null);
  }

  async function saveAddress(contactId: string, value: AddressFormValue): Promise<string | null> {
    const res = await fetch(`${baseUrl}/${contactId}/address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Something went wrong.";
    router.refresh();
    return null;
  }

  const active = contacts.filter((c) => c.isActive);
  const inactive = contacts.filter((c) => !c.isActive);

  function renderRelationshipFields(
    form: ContactFormState,
    setForm: (f: ContactFormState) => void
  ) {
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
          >
            {RELATIONSHIP_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {form.relationship === "OTHER" && (
            <input
              value={form.relationshipOther}
              onChange={(e) => setForm({ ...form, relationshipOther: e.target.value })}
              placeholder="Specify relationship"
              className="text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.isPrimaryContact}
              onChange={(e) => setForm({ ...form, isPrimaryContact: e.target.checked })}
            />
            Primary Contact
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.isGuardian}
              onChange={(e) => setForm({ ...form, isGuardian: e.target.checked })}
            />
            Guardian
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.isEmergencyContact}
              onChange={(e) => setForm({ ...form, isEmergencyContact: e.target.checked })}
            />
            Emergency Contact
          </label>
        </div>
      </>
    );
  }

  function renderContact(c: FamilyContactData) {
    const editing = editingId === c.id;
    const confirming = confirmDeactivateId === c.id;
    const expanded = expandedAddressId === c.id;

    return (
      <div
        key={c.id}
        className={`border rounded-lg p-4 ${c.isActive ? "border-slate-200" : "border-slate-100 bg-slate-50"}`}
      >
        {editing ? (
          <div className="space-y-3">
            <input
              value={editDraft.fullName}
              onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })}
              placeholder="Full name"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
            <input
              value={editDraft.mobileNumber}
              onChange={(e) => setEditDraft({ ...editDraft, mobileNumber: e.target.value })}
              placeholder="Mobile number (optional)"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
            />
            {renderRelationshipFields(editDraft, setEditDraft)}
            <div className="flex gap-3">
              <button
                onClick={() => saveEdit(c.id)}
                disabled={saving}
                className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-4 py-1.5 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium ${c.isActive ? "text-slate-800" : "text-slate-400"}`}>{c.fullName}</p>
                <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  {relationshipLabel(c.relationship, c.relationshipOther)}
                </span>
                {!c.isActive && (
                  <span className="text-xs bg-slate-200 text-slate-500 rounded-full px-2 py-0.5">Inactive</span>
                )}
              </div>
              {c.mobileNumber && <p className="text-sm text-slate-500 mt-0.5">{c.mobileNumber}</p>}
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {c.isPrimaryContact && (
                  <span className="text-xs font-semibold bg-blue-50 text-mega-navy rounded-full px-2 py-0.5">
                    Primary Contact
                  </span>
                )}
                {c.isGuardian && (
                  <span className="text-xs font-semibold bg-green-50 text-mega-green rounded-full px-2 py-0.5">
                    Guardian
                  </span>
                )}
                {c.isEmergencyContact && (
                  <span className="text-xs font-semibold bg-red-50 text-mega-red rounded-full px-2 py-0.5">
                    Emergency Contact
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditDraft(toFormState(c));
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Edit
                </button>
                {confirming ? (
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-mega-red">Deactivate?</span>
                    <button
                      onClick={() => toggleActive(c)}
                      className="text-xs font-semibold text-mega-red hover:text-red-700"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setConfirmDeactivateId(null)} className="text-xs text-slate-400">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => (c.isActive ? setConfirmDeactivateId(c.id) : toggleActive(c))}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {c.isActive ? "Deactivate" : "Reactivate"}
                  </button>
                )}
              </div>
              <button
                onClick={() => setExpandedAddressId(expanded ? null : c.id)}
                className="text-xs text-mega-blue font-medium"
              >
                {expanded ? "Hide address" : c.address ? "View/edit address" : "+ Add address"}
              </button>
            </div>
          </div>
        )}

        {expanded && !editing && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <AddressCard
              title="Address"
              initialValue={c.address}
              onSave={(v) => saveAddress(c.id, v)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-3 text-sm text-red-700 mb-4">{error}</div>
      )}

      <div className="space-y-3 mb-4">
        {contacts.length === 0 && !showAddForm && (
          <p className="text-slate-400 text-sm">No family or emergency contacts on file yet.</p>
        )}
        {active.map(renderContact)}
        {inactive.map(renderContact)}
      </div>

      {showAddForm ? (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Add a Family / Emergency Contact</p>
          <input
            value={newContact.fullName}
            onChange={(e) => setNewContact({ ...newContact, fullName: e.target.value })}
            placeholder="Full name"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          <input
            value={newContact.mobileNumber}
            onChange={(e) => setNewContact({ ...newContact, mobileNumber: e.target.value })}
            placeholder="Mobile number (optional)"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
          />
          {renderRelationshipFields(newContact, setNewContact)}
          <div className="flex gap-3">
            <button
              onClick={addContact}
              disabled={adding}
              className="text-xs font-semibold text-white bg-mega-navy rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Contact"}
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewContact(BLANK_FORM);
              }}
              className="text-xs text-slate-500"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="text-sm font-semibold text-mega-navy bg-blue-50 rounded-full px-4 py-1.5 hover:bg-blue-100 transition"
        >
          + Add Contact
        </button>
      )}
    </div>
  );
}
