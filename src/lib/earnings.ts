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

/** What a contributor has earned, less what is already asked for or paid. */
export type Payable = {
  /** Everything they have ever earned. */
  totalCents: number;
  /** Sitting in a request the desk has not answered yet. */
  pendingCents: number;
  /** Already paid out against earlier requests. */
  paidCents: number;
  /** What they could ask for right now. */
  availableCents: number;
};

/**
 * The money question: how much can this person ask to be paid?
 *
 * Total earnings on its own is the wrong answer. A contributor paid once would
 * still show the same total and could ask for it again, and the desk would have
 * no way of noticing. So anything already paid, and anything already asked for
 * and not yet answered, comes off the top.
 *
 * A declined request is not deducted - the money is still theirs to ask for.
 */
export async function payableFor(userId: string): Promise<Payable> {
  const [earnings, byStatus] = await Promise.all([
    earningsFor(userId),
    prisma.payoutRequest.groupBy({
      by: ["status"],
      where: { userId, status: { in: ["PENDING", "PAID"] } },
      _sum: { amountCents: true },
    }),
  ]);

  const sum = (status: string) =>
    byStatus.find((row) => row.status === status)?._sum.amountCents ?? 0;
  const pendingCents = sum("PENDING");
  const paidCents = sum("PAID");

  return {
    totalCents: earnings.totalCents,
    pendingCents,
    paidCents,
    // A deduction by the desk can in principle take the total below what has
    // already been paid; never offer a negative figure.
    availableCents: Math.max(0, earnings.totalCents - pendingCents - paidCents),
  };
}
