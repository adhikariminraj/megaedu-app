"use client";

import { useRouter } from "next/navigation";
import AddressCard from "@/components/AddressCard";
import { AddressFormValue } from "@/components/AddressForm";

/**
 * School Admin's view of a Student's or Teacher's Current + Permanent
 * address — editable (Admin correction authority) or read-only
 * (everyone else who can reach this page, e.g. a Teacher viewing a
 * Student's profile). `patchUrl` is the school-scoped address route for
 * that specific person (.../students/[id]/address or
 * .../teachers/[id]/address) — both write to the SAME Address rows the
 * person's own My Profile edits, per the shared-record design.
 */
export default function PersonAddressManager({
  patchUrl,
  current,
  permanent,
  readOnly,
}: {
  patchUrl: string;
  current: AddressFormValue | null;
  permanent: AddressFormValue | null;
  readOnly: boolean;
}) {
  const router = useRouter();

  async function save(label: "CURRENT" | "PERMANENT", value: AddressFormValue): Promise<string | null> {
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...value, label }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Something went wrong.";
    router.refresh();
    return null;
  }

  return (
    <div className="space-y-4">
      <AddressCard
        title="Current Address"
        initialValue={current}
        onSave={readOnly ? undefined : (v) => save("CURRENT", v)}
        readOnly={readOnly}
      />
      <AddressCard
        title="Permanent Address"
        initialValue={permanent}
        onSave={readOnly ? undefined : (v) => save("PERMANENT", v)}
        readOnly={readOnly}
      />
    </div>
  );
}
