import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { translationSlug } from "@/lib/articles";
import { other } from "@/lib/i18n";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().trim().min(1).max(400),
  dek: z.string().trim().max(800).optional(),
  body: z.string().trim().min(1).max(200_000),
});

/**
 * PUT /api/drafts/:id/translation
 *
 * A contributor writing BOTH versions themselves - the piece then goes into the
 * queue for both sections at once. The locale is always the opposite of the one
 * they wrote the original in, so a writer cannot overwrite their own copy by
 * accident. The editor still reviews and can rewrite either version.
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.authorId !== user.id) throw new HttpError(403, "Not your article");
    if (article.status === "SUBMITTED") {
      throw new HttpError(409, "This piece is in the editorial queue and cannot be edited");
    }
    if (article.status === "APPROVED") {
      throw new HttpError(409, "Published articles are edited by an editor");
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the second version", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const { title, dek, body } = parsed.data;
    const locale = other(article.language);

    const existing = await prisma.articleTranslation.findUnique({
      where: { articleId_locale: { articleId: id, locale } },
    });
    const slug =
      existing && existing.title === title
        ? existing.slug
        : await translationSlug(title, article.slug, locale, existing?.id);

    const translation = await prisma.articleTranslation.upsert({
      where: { articleId_locale: { articleId: id, locale } },
      create: {
        articleId: id,
        locale,
        title,
        dek: dek ?? null,
        body,
        slug,
        translatorId: user.id,
      },
      update: { title, dek: dek ?? null, body, slug, translatorId: user.id },
    });

    return Response.json({ translation });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/drafts/:id/translation - drop the second version again. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.authorId !== user.id) throw new HttpError(403, "Not your article");
    if (article.status === "SUBMITTED" || article.status === "APPROVED") {
      throw new HttpError(409, "This piece is no longer yours to change");
    }
    await prisma.articleTranslation.deleteMany({
      where: { articleId: id, locale: other(article.language) },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
