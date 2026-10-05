import { prisma } from "@/lib/prisma";
import { errorResponse, requireRole } from "@/lib/rbac";

/** GET /api/editorial/queue?status=SUBMITTED - the moderation queue (Editor / Admin). */
export async function GET(req: Request) {
  try {
    await requireRole("EDITOR", "ADMIN");
    const status = new URL(req.url).searchParams.get("status") ?? "SUBMITTED";
    const valid = ["SUBMITTED", "APPROVED", "REJECTED", "DRAFT"] as const;
    const where =
      status === "ALL"
        ? {}
        : { status: (valid as readonly string[]).includes(status) ? (status as "SUBMITTED") : "SUBMITTED" };

    const articles = await prisma.article.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { updatedAt: "desc" }],
      include: {
        author: { select: { id: true, name: true, email: true, tier: true, role: true } },
        media: true,
        reviews: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return Response.json({ articles });
  } catch (err) {
    return errorResponse(err);
  }
}
