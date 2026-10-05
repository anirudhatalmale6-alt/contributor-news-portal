import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/**
 * Where uploaded photos and clips live.
 *
 * Two drivers, chosen with STORAGE_DRIVER:
 *   disk (default) - a directory on the server. Right for a VPS.
 *   db             - bytes in Postgres. Right for Vercel / Netlify and anything
 *                    else with no writable disk between requests.
 *
 * Either way nothing else in the app knows or cares: uploads are addressed as
 * /media/<name>, and swapping in S3 or R2 later means editing this file only.
 */

export type Driver = "disk" | "db";

export const driver: Driver = process.env.STORAGE_DRIVER === "db" ? "db" : "disk";

export function uploadDir() {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), "storage", "uploads");
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

export async function saveUpload(file: File) {
  const ext = (file.name.split(".").pop() ?? "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const name = `${randomUUID()}.${ext || "bin"}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (driver === "db") {
    await prisma.mediaBlob.create({
      data: {
        id: name,
        contentType: file.type || contentTypeFor(name),
        size: buffer.byteLength,
        bytes: buffer,
      },
    });
  } else {
    const dir = uploadDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer);
  }

  return { name, url: `/media/${name}` };
}

export type StoredFile = {
  body: Buffer;
  contentType: string;
  size: number;
  etag: string;
};

/** Reads a stored file back, or null when there is no such name. */
export async function readUpload(name: string): Promise<StoredFile | null> {
  if (driver === "db") {
    const blob = await prisma.mediaBlob.findUnique({ where: { id: name } });
    if (!blob) return null;
    return {
      body: Buffer.from(blob.bytes),
      contentType: blob.contentType,
      size: blob.size,
      etag: `"${blob.size.toString(16)}-${blob.id.slice(0, 8)}"`,
    };
  }

  const file = path.join(uploadDir(), name);
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    return {
      body: await readFile(file),
      contentType: contentTypeFor(name),
      size: info.size,
      etag: `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
    };
  } catch {
    return null;
  }
}
