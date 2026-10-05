import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/drafts/:id/submit
 * Pushes a draft into the editorial queue. Verified or General makes no
 * difference here - every piece is reviewed before it can go live.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.authorId !== user.id) throw new HttpError(403, "Not your article");
    if (article.status === "SUBMITTED") throw new HttpError(409, "Already submitted");
    if (article.status === "APPROVED") throw new HttpError(409, "Already published");
    if (!article.title.trim() || article.body.trim().length < 50) {
      throw new HttpError(422, "Add a title and at least 50 characters of copy before submitting");
    }

    const resubmission = article.status === "REJECTED";
    const [updated] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      }),
      prisma.review.create({
        data: {
          articleId: id,
          editorId: null,
          action: resubmission ? "RESUBMITTED" : "SUBMITTED",
          fromStatus: article.status,
          toStatus: "SUBMITTED",
        },
      }),
    ]);
    return Response.json({ article: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
