"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InquiryResolveButton({
  schoolId,
  inquiryId,
  status,
}: {
  schoolId: string;
  inquiryId: string;
  status: "NEW" | "RESOLVED";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const res = await fetch(`/api/schools/${schoolId}/inquiries/${inquiryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status === "NEW" ? "RESOLVED" : "NEW" }),
    });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`text-xs font-semibold rounded-full px-3 py-1.5 transition disabled:opacity-50 ${
        status === "NEW"
          ? "bg-mega-navy text-white hover:bg-mega-blue"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {saving ? "..." : status === "NEW" ? "Mark Resolved" : "Reopen"}
    </button>
  );
}
