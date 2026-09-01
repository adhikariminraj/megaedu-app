"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export default function SchoolLogoManager({
  schoolId,
  schoolName,
  logoUrl,
}: {
  schoolId: string;
  schoolName: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 2MB or smaller.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/schools/${schoolId}/logo`, { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));

    setLoading(false);
    URL.revokeObjectURL(localPreview);
    setPreview(null);

    if (!res.ok) {
      setError(body.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleRemove() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/schools/${schoolId}/logo`, { method: "DELETE" });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5">
      <h3 className="font-semibold text-slate-800 mb-1">School Logo</h3>
      <p className="text-xs text-slate-400 mb-4">
        Shown on your School Directory card and profile page. PNG, JPEG, or WebP, up to 2MB.
      </p>

      <div className="flex items-center gap-4">
        <Avatar src={preview || logoUrl} name={schoolName} variant="school" size="xl" />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={pickFile}
              disabled={loading}
              className="text-sm font-semibold bg-mega-navy text-white px-4 py-2 rounded-full hover:bg-mega-blue transition disabled:opacity-50"
            >
              {loading ? "Uploading..." : logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                className="text-sm font-medium text-mega-red hover:text-red-700 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          {error && <p className="text-xs text-mega-red">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
