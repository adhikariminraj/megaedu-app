"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AddressCard from "@/components/AddressCard";
import { AddressFormValue } from "@/components/AddressForm";

type AddressEntry = { value: AddressFormValue; summary: string } | null;

/**
 * My Profile K1 — collapsed-by-default address summary, expanding into
 * the existing AddressCard/AddressForm (untouched) only when the user
 * chooses Edit, then collapsing again after a successful save. Saves
 * through the same /api/me/address PATCH this always used — no change
 * to the write path, authorization, or cascading Province -> District
 * -> Local Level -> Ward behavior, all of which live entirely inside
 * AddressForm/the API route and are untouched here.
 */
export default function ProfileAddressManager({
  current,
  permanent,
}: {
  current: AddressEntry;
  permanent: AddressEntry;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ CURRENT: boolean; PERMANENT: boolean }>({
    CURRENT: false,
    PERMANENT: false,
  });

  async function save(label: "CURRENT" | "PERMANENT", value: AddressFormValue): Promise<string | null> {
    const res = await fetch("/api/me/address", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...value, label }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Something went wrong.";
    setEditing((e) => ({ ...e, [label]: false }));
    router.refresh();
    return null;
  }

  function Row({
    label,
    title,
    entry,
  }: {
    label: "CURRENT" | "PERMANENT";
    title: string;
    entry: AddressEntry;
  }) {
    if (editing[label]) {
      return (
        <AddressCard
          title={title}
          initialValue={entry?.value ?? null}
          onSave={(v) => save(label, v)}
        />
      );
    }

    return (
      <div className="border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          {entry ? (
            <p className="text-sm text-slate-500 mt-0.5">{entry.summary}</p>
          ) : (
            <p className="text-sm text-slate-400 mt-0.5">
              No {label === "CURRENT" ? "current" : "permanent"} address added
            </p>
          )}
        </div>
        <button
          onClick={() => setEditing((e) => ({ ...e, [label]: true }))}
          className="text-xs font-semibold text-mega-blue hover:text-mega-navy transition shrink-0"
        >
          {entry ? "Edit" : "Add address"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Row label="CURRENT" title="Current Address" entry={current} />
      <Row label="PERMANENT" title="Permanent Address" entry={permanent} />
    </div>
  );
}
