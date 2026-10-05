import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireRole } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  dek: z.string().trim().max(300).nullable().optional(),
  body: z.string().max(200_000).optional(),
  category: z.string().trim().max(60).optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
});

/** GET /api/editorial/:id - full article + audit trail, for the review screen. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireRole("EDITOR", "ADMIN");
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, tier: true } },
        media: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { editor: { select: { name: true, role: true } } },
        },
      },
    });
    if (!article) throw new HttpError(404, "Article not found");
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/editorial/:id - an editor fine-tuning wording or media, any status. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const staff = await requireRole("EDITOR", "ADMIN");
    const { id } = await params;
    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Article not found");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the form", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const data = parsed.data;

    const article = await prisma.article.update({
      where: { id },
      data: {
        ...data,
        reviewerId: staff.id,
        slug:
          data.title && data.title !== existing.title
            ? await uniqueSlug(data.title, id)
            : existing.slug,
      },
      include: { media: true },
    });
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}
