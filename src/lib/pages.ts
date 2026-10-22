import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * The owner's own pages - About us, Contact, Privacy policy and so on.
 *
 * Each has a Bangla and an English version. If one language has not been
 * written yet the page shows the other rather than a blank page, so a page is
 * never broken for half the readers just because one translation is missing.
 */

export const pagePath = (locale: Locale, slug: string) => (locale === "BN" ? `/p/${slug}` : `/en/p/${slug}`);

export function localised(page: { titleBn: string; titleEn: string; bodyBn: string; bodyEn: string }, locale: Locale) {
  const want = locale === "BN" ? { title: page.titleBn, body: page.bodyBn } : { title: page.titleEn, body: page.bodyEn };
  const other = locale === "BN" ? { title: page.titleEn, body: page.bodyEn } : { title: page.titleBn, body: page.bodyBn };
  const title = want.title.trim() || other.title.trim();
  const usingOther = !want.body.trim() && Boolean(other.body.trim());
  return { title, body: usingOther ? other.body : want.body, lang: (usingOther ? (locale === "BN" ? "EN" : "BN") : locale) as Locale };
}

/** The pages linked from the footer, in the owner's order. */
export async function footerPages(locale: Locale) {
  const rows = await prisma.page.findMany({
    where: { published: true, inFooter: true },
    orderBy: [{ footerOrder: "asc" }, { createdAt: "asc" }],
    select: { slug: true, titleBn: true, titleEn: true, bodyBn: true, bodyEn: true },
  });
  return rows
    .map((r) => ({ href: pagePath(locale, r.slug), label: localised(r, locale).title }))
    .filter((p) => p.label);
}

export async function publishedPage(slug: string) {
  return prisma.page.findFirst({ where: { slug, published: true } });
}

/** A web address for a new page: from its English title, else its Bangla one, never taken twice. */
export async function uniquePageSlug(wanted: string, ignoreId?: string) {
  const base = slugify(wanted) === "article" ? "page" : slugify(wanted);
  let candidate = base;
  for (let n = 2; n < 50; n++) {
    const clash = await prisma.page.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/** What the Pages screen sends. */
export const pageSchema = z.object({
  titleBn: z.string().trim().max(200).default(""),
  titleEn: z.string().trim().max(200).default(""),
  bodyBn: z.string().max(100000).default(""),
  bodyEn: z.string().max(100000).default(""),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "The web address can use only small letters, numbers and dashes")
    .optional(),
  published: z.boolean().default(false),
  inFooter: z.boolean().default(true),
  footerOrder: z.coerce.number().int().min(0).max(999).default(0),
});
