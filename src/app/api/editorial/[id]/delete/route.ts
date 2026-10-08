import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * DELETE /api/editorial/:id/delete - remove a piece for good.
 *
 * Admins and the owner only: an editor can send a piece back, which is
 * reversible, but taking something off the record is not. Everything hanging
 * off the article goes with it (its translation, its media rows, its review
 * history) because leaving orphans behind would make the counts lie.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, title: true, status: true },
    });
    if (!article) throw new HttpError(404, "That article no longer exists");

    // Media and translations cascade from the schema; the review trail does
    // not, so it is cleared here rather than left pointing at nothing.
    await prisma.$transaction([
      prisma.review.deleteMany({ where: { articleId: id } }),
      prisma.inboxThread.updateMany({ where: { articleId: id }, data: { articleId: null } }),
      prisma.article.delete({ where: { id } }),
    ]);

    refreshPublicPages();
    return Response.json({ deleted: { id: article.id, title: article.title } });
  } catch (err) {
    return errorResponse(err);
  }
}
