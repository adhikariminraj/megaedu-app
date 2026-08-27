"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EnrollButton({
  courseId,
  courseSlug,
  isFree,
  loggedIn,
  existingEnrollmentId,
}: {
  courseId: string;
  courseSlug: string;
  isFree: boolean;
  loggedIn: boolean;
  existingEnrollmentId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingEnrollmentId) {
    return (
      <Link
        href={`/courses/${courseSlug}/learn`}
        className="inline-block bg-mega-gold text-slate-900 font-semibold px-6 py-3 rounded-full hover:brightness-95 transition"
      >
        Continue Learning →
      </Link>
    );
  }

  if (!loggedIn) {
    return (
      <Link
        href="/login"
        className="inline-block bg-mega-gold text-slate-900 font-semibold px-6 py-3 rounded-full hover:brightness-95 transition"
      >
        Log in to Enroll
      </Link>
    );
  }

  async function handleEnroll() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/courses/${courseId}/enroll`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      setLoading(false);
      return;
    }
    router.push(`/courses/${courseSlug}/learn`);
  }

  return (
    <div>
      <button
        onClick={handleEnroll}
        disabled={loading || !isFree}
        className="bg-mega-gold text-slate-900 font-semibold px-6 py-3 rounded-full hover:brightness-95 transition disabled:opacity-50"
      >
        {loading ? "Enrolling..." : isFree ? "Enroll for Free" : "Paid enrollment coming soon"}
      </button>
      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
    </div>
  );
}
