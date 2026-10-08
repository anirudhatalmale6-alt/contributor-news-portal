import { z } from "zod";
import { formComplaint } from "@/lib/zod-message";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";
import { translationSlug } from "@/lib/articles";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  locale: z.enum(["EN", "BN"]),
  title: z.string().trim().min(1).max(400),
  dek: z.string().trim().max(800).optional(),
  body: z.string().trim().min(1).max(200_000),
});

/** GET /api/editorial/:id/translation - both language versions of a piece. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        language: true,
        title: true,
        dek: true,
        body: true,
        translations: {
          include: { translator: { select: { name: true } } },
        },
      },
    });
    if (!article) throw new HttpError(404, "Article not found");
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/editorial/:id/translation
 * The editor's version of the piece in the other language. One row per
 * article per locale, so saving twice updates rather than duplicates.
 */
export async function PUT(req: Request, { params }: Ctx) {
  try {
    const staff = await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      return Response.json(
        {
          error:
            formComplaint(issues, {
              title: "English headline",
              dek: "English standfirst",
              body: "English text",
            }) || "Check the translation",
          issues,
        },
        { status: 422 },
      );
    }
    const { locale, title, dek, body } = parsed.data;

    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) throw new HttpError(404, "Article not found");
    if (article.language === locale) {
      throw new HttpError(409, "That is the language the piece was written in");
    }

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
        translatorId: staff.id,
      },
      update: { title, dek: dek ?? null, body, slug, translatorId: staff.id },
    });

    await prisma.review.create({
      data: {
        articleId: id,
        editorId: staff.id,
        action: "TRANSLATION_SAVED",
        note: `${locale === "BN" ? "Bangla" : "English"} version saved`,
        fromStatus: article.status,
        toStatus: article.status,
      },
    });

    return Response.json({ translation });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/editorial/:id/translation?locale=BN */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;
    const locale = new URL(req.url).searchParams.get("locale");
    if (locale !== "EN" && locale !== "BN") {
      throw new HttpError(422, "locale must be EN or BN");
    }
    await prisma.articleTranslation.deleteMany({ where: { articleId: id, locale } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
