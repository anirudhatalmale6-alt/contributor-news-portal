import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";

/** Four percentages: left, top, width, height, of the original picture. */
const crop = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?(,\d+(\.\d+)?){3}$/, "A crop is four numbers separated by commas")
  .nullable();

const schema = z.object({
  coverCropHome: crop.optional(),
  coverCropArticle: crop.optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/editorial/:id/cover-crop
 *
 * Stores how the cover is framed in each place it appears. Nothing is done to
 * the file itself, so an editor can re-crop as often as they like and the
 * original photograph is always still there underneath.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the crop");
    }
    if (parsed.data.coverCropHome === undefined && parsed.data.coverCropArticle === undefined) {
      throw new HttpError(422, "Nothing to change");
    }

    const article = await prisma.article.findUnique({ where: { id }, select: { id: true } });
    if (!article) throw new HttpError(404, "Article not found");

    const updated = await prisma.article.update({
      where: { id },
      data: parsed.data,
      select: { id: true, coverCropHome: true, coverCropArticle: true },
    });
    return Response.json({ article: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
