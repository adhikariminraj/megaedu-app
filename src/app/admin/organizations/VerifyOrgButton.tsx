"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyOrgButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    await fetch(`/api/admin/organizations/${orgId}/verify`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={verify}
      disabled={loading}
      className="bg-mega-green text-white text-sm font-semibold px-4 py-2 rounded-full hover:brightness-95 transition disabled:opacity-50"
    >
      {loading ? "Verifying..." : "Verify"}
    </button>
  );
}
