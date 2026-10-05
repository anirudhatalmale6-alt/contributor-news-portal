import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, isStaff, requireUser } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 8 * 1024 * 1024; // 8 MB
const MAX_VIDEO = 128 * 1024 * 1024; // 128 MB

/**
 * POST /api/uploads  (multipart: file, articleId, caption?)
 * Attaches an image or video to a draft. Local disk here for the prototype;
 * the same handler points at S3 / Cloudflare R2 in production by swapping
 * `storeFile` - nothing else in the app changes.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    const articleId = String(form.get("articleId") ?? "");
    const caption = String(form.get("caption") ?? "").slice(0, 300) || null;

    if (!(file instanceof File)) throw new HttpError(422, "No file received");
    if (!articleId) throw new HttpError(422, "articleId is required");

    const article = await prisma.article.findUnique({ where: { id: articleId } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.authorId !== user.id && !isStaff(user.role)) {
      throw new HttpError(403, "Not your article");
    }

    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      throw new HttpError(415, `Unsupported file type: ${file.type || "unknown"}`);
    }
    if (isImage && file.size > MAX_IMAGE) throw new HttpError(413, "Images must be under 8 MB");
    if (isVideo && file.size > MAX_VIDEO) throw new HttpError(413, "Videos must be under 128 MB");

    const { url } = await saveUpload(file);

    const media = await prisma.media.create({
      data: { articleId, kind: isImage ? "IMAGE" : "VIDEO", url, caption },
    });

    // First image uploaded doubles as the cover shot unless one is already set.
    if (isImage && !article.coverImage) {
      await prisma.article.update({ where: { id: articleId }, data: { coverImage: url } });
    }

    return Response.json({ media }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
