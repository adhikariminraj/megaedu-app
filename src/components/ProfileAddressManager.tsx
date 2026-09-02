"use client";

import { useRouter } from "next/navigation";
import AddressCard from "@/components/AddressCard";
import { AddressFormValue } from "@/components/AddressForm";

/**
 * My Profile's self-service Current + Permanent address editor. Saves
 * through /api/me/address, which always writes to the logged-in
 * session's own userId — the same record a School Admin correcting
 * this person's file (Student/Teacher detail pages) reads and writes,
 * not a separate copy.
 */
export default function ProfileAddressManager({
  current,
  permanent,
}: {
  current: AddressFormValue | null;
  permanent: AddressFormValue | null;
}) {
  const router = useRouter();

  async function save(label: "CURRENT" | "PERMANENT", value: AddressFormValue): Promise<string | null> {
    const res = await fetch("/api/me/address", {
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
        description="Where you live right now."
        initialValue={current}
        onSave={(v) => save("CURRENT", v)}
      />
      <AddressCard
        title="Permanent Address"
        description="Your permanent/home address, if different from your current one."
        initialValue={permanent}
        onSave={(v) => save("PERMANENT", v)}
      />
    </div>
  );
}
