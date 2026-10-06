import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";

/** The single SiteSettings row (masthead, wording, ad slots). Server-only. */
export async function siteSettings() {
  return (
    (await prisma.siteSettings.findUnique({ where: { id: 1 } })) ??
    prisma.siteSettings.create({ data: { id: 1 } })
  );
}

/** The single PaymentSettings row, created on first read. Server-only. */
export async function paymentSettings() {
  return (
    (await prisma.paymentSettings.findUnique({ where: { id: 1 } })) ??
    prisma.paymentSettings.create({ data: { id: 1 } })
  );
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
