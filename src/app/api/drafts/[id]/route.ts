import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { uniqueSlug } from "@/lib/settings";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  dek: z.string().trim().max(300).nullable().optional(),
  body: z.string().max(200_000).optional(),
  category: z.string().trim().max(60).optional(),
  coverImage: z.string().trim().max(500).nullable().optional(),
  language: z.enum(["EN", "BN"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function ownDraft(id: string, userId: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    include: { media: true, reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!article) throw new HttpError(404, "Article not found");
  if (article.authorId !== userId) throw new HttpError(403, "Not your article");
  return article;
}

/** GET /api/drafts/:id */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return Response.json({ article: await ownDraft(id, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/drafts/:id - autosave / manual save.
 * A SUBMITTED article is locked (it is sitting in the editors' queue); a
 * REJECTED one drops back to DRAFT so the writer can resubmit.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await ownDraft(id, user.id);

    if (existing.status === "SUBMITTED") {
      throw new HttpError(409, "This piece is in the editorial queue and cannot be edited");
    }
    if (existing.status === "APPROVED") {
      throw new HttpError(409, "Published articles are edited by an editor");
    }

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
        status: existing.status === "REJECTED" ? "DRAFT" : existing.status,
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

/** DELETE /api/drafts/:id - only an unpublished piece can be thrown away. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await ownDraft(id, user.id);
    if (existing.status === "APPROVED") {
      throw new HttpError(409, "Published articles cannot be deleted by the author");
    }
    await prisma.article.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
