import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Shared image-upload handling for School Logos and User Profile Photos.
 * Local filesystem storage under public/uploads/ (gitignored — never
 * committed) is the simplest architecture for the current deployment
 * model: no production hosting has been decided yet (see DEPLOYMENT.md),
 * and this assumes a persistent, writable filesystem — true for a
 * traditional server/container-with-volume, NOT true for typical
 * serverless/edge hosting. Before that kind of deployment, this should
 * move behind an object-storage adapter (S3-compatible) — the schema
 * (a plain URL string on logoUrl/avatarUrl) doesn't need to change for
 * that swap, only these two functions would.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2MB

// Server-side validation only — never trust the client-supplied
// filename or the browser's reported Content-Type. Sniffed from the
// actual file bytes (magic numbers), same principle as any upload
// boundary: the client is untrusted input.
const MAGIC_BYTES: { ext: string; mime: string; check: (buf: Buffer) => boolean }[] = [
  {
    ext: "png",
    mime: "image/png",
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a,
  },
  {
    ext: "jpg",
    mime: "image/jpeg",
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    ext: "webp",
    mime: "image/webp",
    check: (buf) =>
      buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50,
  },
];

export class UploadValidationError extends Error {}

function detectImageType(buf: Buffer): { ext: string; mime: string } {
  const match = MAGIC_BYTES.find((m) => m.check(buf));
  if (!match) {
    throw new UploadValidationError("Unsupported image format. Only PNG, JPEG, and WebP are allowed.");
  }
  return match;
}

/**
 * Validates and saves an uploaded image under public/uploads/{subdir}/.
 * Returns the root-relative URL to store in the DB (e.g. logoUrl,
 * avatarUrl). The stored filename is always a fresh server-generated
 * UUID — the original filename is never used or trusted.
 */
export async function saveUploadedImage(file: File, subdir: string): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new UploadValidationError("Image must be 2MB or smaller.");
  }
  if (file.size === 0) {
    throw new UploadValidationError("Uploaded file is empty.");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { ext } = detectImageType(buf);

  const dir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buf);

  return `/uploads/${subdir}/${filename}`;
}

/**
 * Best-effort delete of a previously stored upload, given the root-
 * relative URL saved in the DB. Only ever called AFTER the new image
 * has been saved and the DB row updated successfully — never before,
 * so a failed upload or DB write never leaves a user without their
 * previous logo/photo. Silently ignores a missing file (already gone,
 * or the URL points somewhere this helper didn't write, e.g. a future
 * external URL) rather than surfacing a cleanup failure to the user.
 */
export async function deleteUploadedImage(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.join(process.cwd(), "public", url);
  try {
    await unlink(filePath);
  } catch {
    // Already gone, or never existed on disk — nothing to do.
  }
}
