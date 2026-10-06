import { prisma } from "@/lib/prisma";
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

  // ?download=1 hands the original file over with the name the contributor gave
  // it, so an editor can open it in an image editor and re-attach it.
  const download = new URL(req.url).searchParams.has("download");
  let filename = parts[0];
  if (download) {
    const media = await prisma.media.findFirst({
      where: { url: `/media/${parts[0]}` },
      select: { originalName: true },
    });
    if (media?.originalName) filename = media.originalName.replace(/["\\]/g, "");
  }

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      ...(download
        ? { "Content-Disposition": `attachment; filename="${filename}"` }
        : {}),
      "Content-Length": String(file.size),
      ETag: file.etag,
      // Immutable: the filename is a UUID, so the bytes behind it never change.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
