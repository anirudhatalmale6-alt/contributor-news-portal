import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/rbac";
import { readingTime } from "@/lib/format";

/**
 * GET /api/articles?category=&q=&page=&perPage=
 * Public, read-only feed of approved articles. Cached for 60s at the edge so
 * the feed is served from cache even under a traffic spike.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get("perPage") ?? 12) || 12));

    const where = {
      status: "APPROVED" as const,
      ...(category && category !== "All" ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { dek: { contains: q, mode: "insensitive" as const } },
              { body: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          slug: true,
          title: true,
          dek: true,
          body: true,
          category: true,
          coverImage: true,
          publishedAt: true,
          author: { select: { name: true, tier: true, image: true } },
        },
      }),
    ]);

    return Response.json(
      {
        page,
        perPage,
        total,
        articles: rows.map(({ body, ...a }) => ({ ...a, readingMinutes: readingTime(body) })),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
