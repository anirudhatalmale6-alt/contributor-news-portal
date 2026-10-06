import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";

/** The single SiteSettings row (masthead, wording, ad slots). Server-only. */
export async function siteSettings() {
  // upsert, not find-then-create: two requests arriving together on a cold
  // database would both find nothing and both try to insert id = 1.
  return prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** The single PaymentSettings row, created on first read. Server-only. */
export async function paymentSettings() {
  return prisma.paymentSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** Appends -2, -3 ... until the slug is free. `ignoreId` lets a row keep its own slug. */
export async function uniqueSlug(title: string, ignoreId?: string) {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const clash = await prisma.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
