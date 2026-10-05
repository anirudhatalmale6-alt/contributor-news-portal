import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { contentTypeFor, uploadDir } from "@/lib/storage";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /media/:name - serves an uploaded photo or clip.
 * Filenames are UUIDs, and anything with a slash or a dot-dot is refused, so
 * this cannot be walked out of the upload directory.
 */
export async function GET(req: Request, { params }: Ctx) {
  const parts = (await params).path ?? [];
  if (parts.length !== 1 || !/^[A-Za-z0-9._-]+$/.test(parts[0]) || parts[0].includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const file = path.join(uploadDir(), parts[0]);
  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": contentTypeFor(parts[0]),
      "Content-Length": String(info.size),
      ETag: etag,
      // Immutable: the filename is a UUID, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
