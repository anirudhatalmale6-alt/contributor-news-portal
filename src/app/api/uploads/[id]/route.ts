import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, isStaff, requireUser } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/uploads/:mediaId - detach a photo or clip from the piece. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const media = await prisma.media.findUnique({
      where: { id },
      include: { article: true },
    });
    if (!media) throw new HttpError(404, "Media not found");
    if (media.article.authorId !== user.id && !isStaff(user.role)) {
      throw new HttpError(403, "Not your article");
    }

    await prisma.media.delete({ where: { id } });
    if (media.article.coverImage === media.url) {
      const next = await prisma.media.findFirst({
        where: { articleId: media.articleId, kind: "IMAGE" },
        orderBy: { createdAt: "asc" },
      });
      await prisma.article.update({
        where: { id: media.articleId },
        data: { coverImage: next?.url ?? null },
      });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
