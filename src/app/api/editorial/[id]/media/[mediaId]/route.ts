import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

const schema = z.object({
  caption: z.string().trim().max(300).nullable().optional(),
  isEvidence: z.boolean().optional(),
  makeCover: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

/**
 * PATCH /api/editorial/:id/media/:mediaId
 *
 * The editor's control over a contributor's uploads: caption them, choose which
 * ones readers see in the Evidence gallery, and pick the cover shot.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id, mediaId } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Nothing valid to change" }, { status: 422 });
    }
    const { caption, isEvidence, makeCover, sortOrder } = parsed.data;

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media || media.articleId !== id) throw new HttpError(404, "Media not found");

    if (makeCover) {
      if (media.kind !== "IMAGE") throw new HttpError(409, "Only a photo can be the cover");
      await prisma.article.update({ where: { id }, data: { coverImage: media.url } });
    }

    const updated = await prisma.media.update({
      where: { id: mediaId },
      data: {
        ...(caption !== undefined ? { caption } : {}),
        ...(isEvidence !== undefined ? { isEvidence } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
      },
    });

    return Response.json({ media: updated, cover: makeCover ? media.url : undefined });
  } catch (err) {
    return errorResponse(err);
  }
}
