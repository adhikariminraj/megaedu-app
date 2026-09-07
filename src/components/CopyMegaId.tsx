"use client";

import { useState } from "react";

/**
 * My Profile K1 — copies the exact MEGA ID value (unchanged
 * `user.id`) to the clipboard. Purely client-side — no server round
 * trip, since there is nothing to authorize or persist. Never touches
 * anyone's id but the one it was given, which is always the session's
 * own id (this component receives it as a prop from the server-rendered
 * Profile page; it never fetches an id of its own).
 */
export default function CopyMegaId({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(id);
      } else {
        // Fallback for browsers/contexts without the async Clipboard API
        // (older mobile browsers, non-HTTPS) — a temporary, invisible
        // textarea + the legacy execCommand path.
        const textarea = document.createElement("textarea");
        textarea.value = id;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!ok) throw new Error("execCommand copy failed");
      }
      setState("copied");
    } catch {
      setState("error");
    } finally {
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs font-semibold text-mega-blue hover:text-mega-navy transition inline-flex items-center gap-1"
    >
      {state === "copied" ? "Copied ✓" : state === "error" ? "Couldn't copy — select manually" : "Copy MEGA ID"}
    </button>
  );
}
