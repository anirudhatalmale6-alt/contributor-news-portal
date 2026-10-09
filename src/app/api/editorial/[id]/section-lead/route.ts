import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { refreshPublicPages } from "@/lib/revalidate";

const schema = z.object({ sectionLead: z.boolean() });

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/editorial/:id/section-lead - make this piece the top of its own
 * section page, or take it off again.
 *
 * One per section. Setting a new one clears the old rather than refusing: the
 * desk's intent is obvious, and making them go and unpin the previous lead
 * first would only be a second click.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Say whether this piece leads its section");
    const { sectionLead } = parsed.data;

    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, status: true, category: true },
    });
    if (!article) throw new HttpError(404, "Article not found");
    if (sectionLead && article.status !== "APPROVED") {
      throw new HttpError(409, "Publish the piece before giving it the top of its section");
    }

    if (sectionLead) {
      await prisma.article.updateMany({
        where: { category: article.category, sectionLead: true, id: { not: id } },
        data: { sectionLead: false },
      });
    }

    const updated = await prisma.article.update({
      where: { id },
      data: { sectionLead },
      select: { id: true, sectionLead: true, category: true },
    });
    await refreshPublicPages();
    return Response.json({ article: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
