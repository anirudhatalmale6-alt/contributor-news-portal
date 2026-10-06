import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** POST /api/profile/photo (multipart: file) - the signed-in person's picture. */
export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) throw new HttpError(422, "No file received");
    if (!TYPES.includes(file.type)) throw new HttpError(415, "Use a JPEG, PNG or WebP photo");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(413, "Keep the photo under 5 MB");

    const { url } = await saveUpload(file);
    const user = await prisma.user.update({
      where: { id: me.id },
      data: { image: url },
      select: { id: true, image: true },
    });
    return Response.json({ user }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
