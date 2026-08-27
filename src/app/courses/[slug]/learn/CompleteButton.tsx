"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    await fetch(`/api/enrollments/${enrollmentId}/complete`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={complete}
      disabled={loading}
      className="bg-mega-green text-white font-semibold px-6 py-3 rounded-full hover:brightness-95 transition disabled:opacity-50"
    >
      {loading ? "Finishing up..." : "Mark Course Complete →"}
    </button>
  );
}
