import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  payoutCents: z.coerce.number().int().min(0).max(100_000_00),
  note: z.string().trim().max(2000).optional(),
});

/** PATCH /api/editorial/:id/payout - revise the estimated payout after publication. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const staff = await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "Enter a valid amount" }, { status: 422 });
    }

    const existing = await prisma.article.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Article not found");

    const [article] = await prisma.$transaction([
      prisma.article.update({
        where: { id },
        data: { payoutCents: parsed.data.payoutCents, reviewerId: staff.id },
      }),
      prisma.review.create({
        data: {
          articleId: id,
          editorId: staff.id,
          action: "PAYOUT_UPDATED",
          note:
            parsed.data.note ??
            `Payout changed from ${existing.payoutCents} to ${parsed.data.payoutCents} cents`,
          fromStatus: existing.status,
          toStatus: existing.status,
        },
      }),
    ]);
    return Response.json({ article });
  } catch (err) {
    return errorResponse(err);
  }
}
