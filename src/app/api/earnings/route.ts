import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/rbac";
import { paymentSettings } from "@/lib/settings";

/**
 * GET /api/earnings
 * What the contributor dashboard shows: the payout on each published piece
 * plus the running total across everything that went live.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const settings = await paymentSettings();

    const published = await prisma.article.findMany({
      where: { authorId: user.id, status: "APPROVED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        payoutCents: true,
        publishedAt: true,
      },
    });

    const pending = await prisma.article.count({
      where: { authorId: user.id, status: "SUBMITTED" },
    });

    const totalCents = published.reduce((sum, a) => sum + a.payoutCents, 0);
    const awaitingPayout = published.filter((a) => a.payoutCents === 0).length;

    return Response.json({
      currency: settings.currency,
      totalCents,
      publishedCount: published.length,
      pendingReview: pending,
      awaitingPayout,
      articles: published,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
