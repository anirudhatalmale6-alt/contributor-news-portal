import { prisma } from "@/lib/prisma";

export type Earnings = {
  /** Payouts an editor agreed on published pieces. */
  articleCents: number;
  /** Hand-made corrections: bonuses less deductions. */
  adjustmentCents: number;
  /** What the contributor is actually owed. */
  totalCents: number;
};

const empty: Earnings = { articleCents: 0, adjustmentCents: 0, totalCents: 0 };

/**
 * What everybody has earned, in one place.
 *
 * Every screen that shows a figure - the contributor's own desk, the people
 * list, the newsroom total - reads it from here. Two screens computing the same
 * number two ways is how they end up disagreeing.
 */
export async function earningsByUser(userIds?: string[]): Promise<Map<string, Earnings>> {
  const scope = userIds?.length ? { in: userIds } : undefined;
  const [payouts, adjustments] = await Promise.all([
    prisma.article.groupBy({
      by: ["authorId"],
      where: { status: "APPROVED", ...(scope ? { authorId: scope } : {}) },
      _sum: { payoutCents: true },
    }),
    prisma.earningAdjustment.groupBy({
      by: ["userId"],
      where: scope ? { userId: scope } : {},
      _sum: { amountCents: true },
    }),
  ]);

  const out = new Map<string, Earnings>();
  const touch = (id: string) => out.get(id) ?? { ...empty };

  for (const row of payouts) {
    const e = touch(row.authorId);
    e.articleCents = row._sum.payoutCents ?? 0;
    out.set(row.authorId, e);
  }
  for (const row of adjustments) {
    const e = touch(row.userId);
    e.adjustmentCents = row._sum.amountCents ?? 0;
    out.set(row.userId, e);
  }
  for (const e of out.values()) e.totalCents = e.articleCents + e.adjustmentCents;
  return out;
}

/** The same figures for one person. */
export async function earningsFor(userId: string): Promise<Earnings> {
  return (await earningsByUser([userId])).get(userId) ?? { ...empty };
}

/** The site-wide total, for the newsroom summary. */
export async function earningsTotal(): Promise<Earnings> {
  const [payouts, adjustments] = await Promise.all([
    prisma.article.aggregate({ where: { status: "APPROVED" }, _sum: { payoutCents: true } }),
    prisma.earningAdjustment.aggregate({ _sum: { amountCents: true } }),
  ]);
  const articleCents = payouts._sum.payoutCents ?? 0;
  const adjustmentCents = adjustments._sum.amountCents ?? 0;
  return { articleCents, adjustmentCents, totalCents: articleCents + adjustmentCents };
}
