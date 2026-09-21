/**
 * Academy lesson content validation shared by the lesson create and
 * update routes, so the videoUrl rule (introduced in the K10
 * content-integrity hardening) cannot drift between the two paths.
 *
 * videoUrl is optional. When present it must be an http(s) URL — it is
 * rendered to enrolled learners as a link, so javascript:, data: and
 * every other scheme are rejected.
 */
export type VideoUrlResult = { ok: true; value: string | null } | { ok: false; error: string };

const VIDEO_URL_ERROR = "Video link must be an http or https URL.";

export function parseVideoUrl(raw: unknown): VideoUrlResult {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: VIDEO_URL_ERROR };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  let protocol: string | null = null;
  try {
    protocol = new URL(trimmed).protocol;
  } catch {
    protocol = null;
  }
  if (protocol !== "http:" && protocol !== "https:") return { ok: false, error: VIDEO_URL_ERROR };
  return { ok: true, value: trimmed };
}
