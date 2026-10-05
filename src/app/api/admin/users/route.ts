import { prisma } from "@/lib/prisma";
import { errorResponse, requireRole } from "@/lib/rbac";

/** GET /api/admin/users - user management table (Admin only). */
export async function GET() {
  try {
    await requireRole("ADMIN");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        createdAt: true,
        accounts: { select: { provider: true } },
        _count: { select: { articles: true } },
      },
    });

    // Lifetime payout per contributor, straight out of the published rows.
    const sums = await prisma.article.groupBy({
      by: ["authorId"],
      where: { status: "APPROVED" },
      _sum: { payoutCents: true },
    });
    const earned = new Map(sums.map((s) => [s.authorId, s._sum.payoutCents ?? 0]));

    return Response.json({
      users: users.map((u) => ({ ...u, earnedCents: earned.get(u.id) ?? 0 })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
