import { prisma } from "@/lib/prisma";
import { errorResponse, requireStaff } from "@/lib/rbac";

/**
 * GET /api/admin/users?q=&role=
 * The people list, for any staff member. `q` matches an email or a name, in
 * either script, so a contributor can be found by whatever the editor knows.
 */
export async function GET(req: Request) {
  try {
    await requireStaff();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const role = url.searchParams.get("role")?.trim().toUpperCase();

    const users = await prisma.user.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" as const } },
                { name: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(role && ["SUPERADMIN", "ADMIN", "EDITOR", "CONTRIBUTOR"].includes(role)
          ? { role: role as "EDITOR" }
          : {}),
      },
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
