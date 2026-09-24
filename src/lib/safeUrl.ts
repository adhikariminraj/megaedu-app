/**
 * Public-link safety for user-supplied URLs that MEGA.EDU renders as an
 * `href` on public pages (Organization.website, Opportunity.applyUrl).
 * Same http(s)-only rule as Academy's parseVideoUrl (src/lib/academyContent.ts,
 * left untouched) — javascript:, data: and every other scheme are rejected.
 *
 * parseOptionalHttpUrl() is the write-time check; safeHttpHref() is the
 * render-time guard, so a value stored before validation existed (or via a
 * write path that doesn't validate) can never become a live link.
 */
export type HttpUrlResult = { ok: true; value: string | null } | { ok: false; error: string };

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function parseOptionalHttpUrl(raw: unknown, label: string): HttpUrlResult {
  const error = `${label} must be a full link starting with http:// or https://.`;
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!isHttpUrl(trimmed)) return { ok: false, error };
  return { ok: true, value: trimmed };
}

export function safeHttpHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return isHttpUrl(trimmed) ? trimmed : null;
}
