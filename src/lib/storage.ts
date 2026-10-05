import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Uploads live OUTSIDE public/ and are served by the /media route.
 *
 * Why: anything written into public/ after the build is invisible to
 * `next start` (its static file list is fixed at boot) and disappears entirely
 * on a serverless host. Routing media through a handler means the same code
 * works on a VPS today and in front of S3 / R2 later - only this file changes.
 */
export function uploadDir() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "storage", "uploads");
}

export async function saveUpload(file: File) {
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const name = `${randomUUID()}.${ext || "bin"}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { name, url: `/media/${name}` };
}

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const contentTypeFor = (name: string) =>
  TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
