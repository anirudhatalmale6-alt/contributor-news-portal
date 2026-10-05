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
  publishedAt: Date | null;
  isTranslation: boolean;
  translatorName: string | null;
  author: { name: string; tier: string; bio?: string | null };
};

const AUTHOR = { select: { name: true, tier: true, bio: true } } as const;

function pick(
  article: {
    id: string;
    slug: string;
    title: string;
    dek: string | null;
    body: string;
    category: string;
    coverImage: string | null;
    publishedAt: Date | null;
    language: Locale;
    author: { name: string; tier: string; bio?: string | null };
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
