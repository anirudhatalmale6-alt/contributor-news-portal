import { prisma } from "@/lib/prisma";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { locateUpload, readUpload } from "@/lib/storage";
import { isWidth, resizedUpload } from "@/lib/images";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /media/:name - serves an uploaded photo or clip from whichever storage
 * driver is configured. Filenames are UUIDs, and anything with a slash or a
 * dot-dot is refused, so this cannot be walked out of the upload directory.
 */
export async function GET(req: Request, { params }: Ctx) {
  const parts = (await params).path ?? [];
  if (parts.length !== 1 || !/^[A-Za-z0-9._-]+$/.test(parts[0]) || parts[0].includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  // ?w=800 asks for a resized copy. A reader's phone takes one of these; the
  // original is only ever sent when an editor downloads it.
  const url = new URL(req.url);
  const asked = Number(url.searchParams.get("w"));
  const wantsResize = !url.searchParams.has("download") && Number.isFinite(asked) && asked > 0;

  const download = url.searchParams.has("download");

  // Videos, and any original straight off the disk, are sent in slices when
  // the browser asks for one. An iPhone will not play a video at all unless
  // the server answers its "send me bytes 0 to 1" request properly, and every
  // phone asks for slices when the reader skips ahead.
  if (!wantsResize) {
    const onDisk = await locateUpload(parts[0]);
    if (onDisk) {
      if (!download && req.headers.get("if-none-match") === onDisk.etag) {
        return new Response(null, { status: 304, headers: { ETag: onDisk.etag } });
      }
      return sendFromDisk(req, onDisk, download ? await downloadName(parts[0]) : null);
    }
  }

  const file =
    wantsResize && isWidth(asked)
      ? ((await resizedUpload(parts[0], asked)) ?? (await readUpload(parts[0])))
      : await readUpload(parts[0]);
  if (!file) return new Response("Not found", { status: 404 });

  if (req.headers.get("if-none-match") === file.etag) {
    return new Response(null, { status: 304, headers: { ETag: file.etag } });
  }

  // ?download=1 hands the original file over with the name the contributor gave
  // it, so an editor can open it in an image editor and re-attach it.
  const filename = download ? await downloadName(parts[0]) : null;

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      ...(filename ? { "Content-Disposition": disposition(filename) } : {}),
      "Content-Length": String(file.size),
      "Accept-Ranges": "bytes",
      ETag: file.etag,
      // Immutable: the filename is a UUID, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/** The name the contributor's file had, for a download. */
async function downloadName(name: string) {
  const media = await prisma.media.findFirst({
    where: { url: `/media/${name}` },
    select: { originalName: true },
  });
  return media?.originalName || name;
}

/**
 * The download header, safe for any name. A header may only carry plain
 * ASCII, so a Bangla filename put in as it is made the server fail on every
 * download - that is what broke the Evidence download button on videos. The
 * real name goes in the encoded form every browser reads; the plain one is a
 * fallback for anything older.
 */
function disposition(filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "") || "file";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function sendFromDisk(
  req: Request,
  file: { path: string; size: number; contentType: string; etag: string },
  filename: string | null,
) {
  const base: Record<string, string> = {
    "Content-Type": file.contentType,
    "Accept-Ranges": "bytes",
    ETag: file.etag,
    "Cache-Control": "public, max-age=31536000, immutable",
    ...(filename ? { "Content-Disposition": disposition(filename) } : {}),
  };
  const stream = (start: number, end: number) =>
    Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream;

  const range = req.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range || !m || (m[1] === "" && m[2] === "")) {
    return new Response(file.size ? stream(0, file.size - 1) : null, {
      headers: { ...base, "Content-Length": String(file.size) },
    });
  }

  // "bytes=500-999", "bytes=500-" (to the end) or "bytes=-500" (the last 500).
  let start = m[1] === "" ? Math.max(0, file.size - Number(m[2])) : Number(m[1]);
  let end = m[1] !== "" && m[2] !== "" ? Number(m[2]) : file.size - 1;
  end = Math.min(end, file.size - 1);
  if (start > end || start >= file.size) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${file.size}` } });
  }
  start = Math.max(0, start);
  return new Response(stream(start, end), {
    status: 206,
    headers: {
      ...base,
      "Content-Range": `bytes ${start}-${end}/${file.size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}
