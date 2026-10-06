import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireRole } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";

const TYPES = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];

/**
 * POST /api/admin/site/logo (multipart: file)
 * Replaces the masthead without anyone touching the server.
 */
export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "No file received");
    if (!TYPES.includes(file.type)) {
      throw new HttpError(415, "Use a PNG, SVG, JPEG or WebP file");
    }
    if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "Keep the logo under 4 MB");

    const { url } = await saveUpload(file);
    const settings = await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, logoUrl: url },
      update: { logoUrl: url },
    });

    return Response.json({ settings }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
