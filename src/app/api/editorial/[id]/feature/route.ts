import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ featured: z.boolean() });

/**
 * PATCH /api/editorial/:id/feature
 *
 * Approving a piece publishes it; featuring puts it on the front page. Keeping
 * them apart is what stops the home page being whatever happened to be approved
 * last. Only a published piece can be featured.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const staff = await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "featured must be true or false" }, { status: 422 });
    }
    const { featured } = parsed.data;

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Article not found");
    if (featured && existing.status !== "APPROVED") {
      throw new HttpError(409, "Publish the piece before featuring it");
    }

    const [article] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: { featured, featuredAt: featured ? new Date() : null },
      }),
      prisma.review.create({
        data: {
          articleId: id,
          editorId: staff.id,
          action: featured ? "FEATURED" : "UNFEATURED",
          note: featured ? "Put on the front page" : "Removed from the front page",
          fromStatus: existing.status,
          toStatus: existing.status,
        },
      }),
    ]);

    refreshPublicPages();
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}
