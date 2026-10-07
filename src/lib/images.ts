import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { driver, readUpload, uploadDir, type StoredFile } from "@/lib/storage";
import type { Width } from "@/lib/image-sizes";

export { WIDTHS, isWidth, srcSetFor, type Width } from "@/lib/image-sizes";

/**
 * Serving photographs at a sensible size.
 *
 * Contributors send what their phone took: six or seven megabytes of PNG. That
 * is the right thing to keep - an editor may need to crop it, and the Evidence
 * gallery should offer the original - but it is not the thing to send to a
 * reader on a phone.
 *
 * So the original is never touched, and a resized WebP is made the first time
 * a given width is asked for and cached beside it. Every later request is a
 * file read.
 */

const variantName = (name: string, width: Width) => `${name}.w${width}.webp`;

/** The resized copy, making it first if this is the first time it is wanted. */
export async function resizedUpload(name: string, width: Width): Promise<StoredFile | null> {
  const key = variantName(name, width);

  // Already made?
  if (driver === "db") {
    const cached = await prisma.mediaBlob.findUnique({ where: { id: key } });
    if (cached) {
      return {
        body: Buffer.from(cached.bytes),
        contentType: cached.contentType,
        size: cached.size,
        etag: `"${cached.size.toString(16)}-${key.slice(0, 8)}"`,
      };
    }
  } else {
    const file = path.join(uploadDir(), "_resized", key);
    try {
      const info = await stat(file);
      if (info.isFile()) {
        return {
          body: await readFile(file),
          contentType: "image/webp",
          size: info.size,
          etag: `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
        };
      }
    } catch {
      // not made yet, fall through
    }
  }

  const original = await readUpload(name);
  if (!original || !original.contentType.startsWith("image/")) return null;

  let body: Buffer;
  try {
    body = await sharp(original.body, { animated: true })
      // withoutEnlargement: a small picture is served as it is rather than
      // being blown up into a bigger file than the original.
      .resize({ width, withoutEnlargement: true })
      .rotate() // honour the EXIF orientation a phone writes
      .webp({ quality: 72, effort: 4 })
      .toBuffer();
  } catch {
    return null;
  }

  // A resize that saved nothing is not worth storing or serving.
  if (body.byteLength >= original.size) return null;

  if (driver === "db") {
    await prisma.mediaBlob.create({
      data: {
        id: key,
        contentType: "image/webp",
        size: body.byteLength,
        bytes: new Uint8Array(body),
      },
    });
  } else {
    const dir = path.join(uploadDir(), "_resized");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, key), body);
  }

  return {
    body,
    contentType: "image/webp",
    size: body.byteLength,
    etag: `"${body.byteLength.toString(16)}-${key.slice(0, 8)}"`,
  };
}
