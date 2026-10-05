import { readUpload } from "@/lib/storage";

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

  const file = await readUpload(parts[0]);
  if (!file) return new Response("Not found", { status: 404 });

  if (req.headers.get("if-none-match") === file.etag) {
    return new Response(null, { status: 304, headers: { ETag: file.etag } });
  }

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      ETag: file.etag,
      // Immutable: the filename is a UUID, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
