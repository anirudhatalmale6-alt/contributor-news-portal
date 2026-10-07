import { prisma } from "@/lib/prisma";
import type { Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";
import { slugify } from "@/lib/format";

/**
 * One article, two languages. The row itself holds the version the contributor
 * wrote (`language`), and `ArticleTranslation` holds the editor's version in
 * the other language. Everything a public page needs in one locale is resolved
 * here so the pages themselves never have to care which of the two it came
 * from.
 */

export type LocalisedArticle = {
  id: string;
  slug: string;
  href: string;
  title: string;
  dek: string | null;
  body: string;
  category: string;
  coverImage: string | null;
  coverCropHome: string | null;
  coverCropArticle: string | null;
  publishedAt: Date | null;
  isTranslation: boolean;
  translatorName: string | null;
  author: { id?: string; name: string; tier: string; bio?: string | null };
};

const AUTHOR = { select: { id: true, name: true, tier: true, bio: true } } as const;

function pick(
  article: {
    id: string;
    slug: string;
    title: string;
    dek: string | null;
    body: string;
    category: string;
    coverImage: string | null;
    coverCropHome: string | null;
    coverCropArticle: string | null;
    publishedAt: Date | null;
    language: Locale;
    author: { id?: string; name: string; tier: string; bio?: string | null };
    translations: {
      locale: Locale;
      slug: string;
      title: string;
      dek: string | null;
      body: string;
      translator: { name: string } | null;
    }[];
  },
  locale: Locale,
): LocalisedArticle | null {
  const base = {
    id: article.id,
    category: article.category,
    coverImage: article.coverImage,
    coverCropHome: article.coverCropHome,
    coverCropArticle: article.coverCropArticle,
    publishedAt: article.publishedAt,
    author: article.author,
  };

  if (article.language === locale) {
    return {
      ...base,
      slug: article.slug,
      href: localePath(locale, `/article/${article.slug}`),
      title: article.title,
      dek: article.dek,
      body: article.body,
      isTranslation: false,
      translatorName: null,
    };
  }

  const tr = article.translations.find((t) => t.locale === locale);
  if (!tr) return null;
  return {
    ...base,
    slug: tr.slug,
    href: localePath(locale, `/article/${tr.slug}`),
    title: tr.title,
    dek: tr.dek,
    body: tr.body,
    isTranslation: true,
    translatorName: tr.translator?.name ?? null,
  };
}

/** Published pieces that exist in this language, newest first. */
export async function feedArticles(locale: Locale, category: string, take = 13) {
  const rows = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      ...(category !== "All" ? { category } : {}),
      // Either the original is in this language, or the editor translated it.
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: { publishedAt: "desc" },
    take,
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  return rows.map((r) => pick(r, locale)).filter((a): a is LocalisedArticle => a !== null);
}

/**
 * The pieces an editor has pinned to a named place on the front page.
 *
 * Returned slot by slot so the page can take what it was given and fill the
 * rest itself - a half-planned front page still has to look finished.
 */
export async function pinnedArticles(locale: Locale) {
  const rows = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      homeSlot: { not: null },
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: [{ homeOrder: "asc" }, { publishedAt: "desc" }],
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });

  const bySlot = new Map<string, LocalisedArticle[]>();
  for (const r of rows) {
    const a = pick(r, locale);
    if (!a) continue;
    const slot = r.homeSlot as string;
    bySlot.set(slot, [...(bySlot.get(slot) ?? []), a]);
  }
  return bySlot;
}

/** Pieces an editor has put on the front page, newest first. */
export async function featuredArticles(locale: Locale, take = 5) {
  const rows = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      featured: true,
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: { featuredAt: "desc" },
    take,
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  return rows.map((r) => pick(r, locale)).filter((a): a is LocalisedArticle => a !== null);
}

/** More from the same section, for the foot of an article. */
export async function relatedArticles(
  locale: Locale,
  articleId: string,
  category: string,
  take = 4,
) {
  const rows = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      id: { not: articleId },
      category,
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: { publishedAt: "desc" },
    take: take + 2,
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  const related = rows.map((r) => pick(r, locale)).filter((a): a is LocalisedArticle => a !== null);

  // Fall back to the latest from anywhere rather than showing an empty rail.
  if (related.length >= take) return related.slice(0, take);
  const filler = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      id: { not: articleId },
      category: { not: category },
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: { publishedAt: "desc" },
    take,
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  return [...related, ...filler.map((r) => pick(r, locale)).filter((a): a is LocalisedArticle => a !== null)].slice(
    0,
    take,
  );
}

/** Everything one contributor has had published, in this language. */
export async function feedArticlesByAuthor(locale: Locale, authorId: string, take = 24) {
  const rows = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      authorId,
      OR: [{ language: locale }, { translations: { some: { locale } } }],
    },
    orderBy: { publishedAt: "desc" },
    take,
    include: {
      author: AUTHOR,
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  return rows.map((r) => pick(r, locale)).filter((a): a is LocalisedArticle => a !== null);
}

/** A single published piece addressed by its slug in this language. */
export async function articleForLocale(locale: Locale, slug: string) {
  const article = await prisma.article.findFirst({
    where: {
      status: "APPROVED",
      OR: [
        { language: locale, slug },
        { translations: { some: { locale, slug } } },
      ],
    },
    include: {
      author: AUTHOR,
      media: { orderBy: { createdAt: "asc" } },
      translations: { include: { translator: { select: { name: true } } } },
    },
  });
  if (!article) return null;

  const localised = pick(article, locale);
  if (!localised) return null;

  // Where the language switch should point, if the other version exists.
  const counterpart = pick(article, locale === "EN" ? "BN" : "EN");

  return {
    ...localised,
    media: article.media,
    sourceLanguage: article.language as Locale,
    counterpartHref: counterpart?.href ?? null,
  };
}

/**
 * Slugs to pre-render for a locale.
 *
 * Returns nothing if the database is unreachable or the tables do not exist
 * yet: the very first deploy on a fresh host builds before `migrate deploy`
 * has run, and a build that dies there is a terrible first impression. Pages
 * are generated on demand afterwards either way.
 */
export async function publishedSlugs(locale: Locale, take = 200) {
  try {
    return await slugsFor(locale, take);
  } catch (err) {
    console.warn("publishedSlugs: database not ready, skipping prerender", err);
    return [];
  }
}

async function slugsFor(locale: Locale, take: number) {
  const [originals, translations] = await Promise.all([
    prisma.article.findMany({
      where: { status: "APPROVED", language: locale },
      select: { slug: true },
      take,
    }),
    prisma.articleTranslation.findMany({
      where: { locale, article: { status: "APPROVED" } },
      select: { slug: true },
      take,
    }),
  ]);
  return [...originals, ...translations].map((r) => r.slug);
}

/**
 * A Bangla headline slugifies to nothing useful in ASCII, so a translation
 * falls back to the original slug with a language suffix. Still unique, still
 * readable in a URL bar.
 */
export async function translationSlug(title: string, fallback: string, locale: Locale, ignoreId?: string) {
  const ascii = slugify(title);
  let base = ascii && ascii !== "article" ? ascii : `${fallback}-${locale.toLowerCase()}`;
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const [clashArticle, clashTranslation] = await Promise.all([
      prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.articleTranslation.findUnique({ where: { slug: candidate }, select: { id: true } }),
    ]);
    if (!clashArticle && (!clashTranslation || clashTranslation.id === ignoreId)) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
