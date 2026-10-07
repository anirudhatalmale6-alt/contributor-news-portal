import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, requireStaff } from "@/lib/rbac";

export const HOME_SLOTS = ["LEAD", "STRIP", "LEFT", "MIDDLE", "RIGHT"] as const;

const schema = z.object({
  /** Null takes the piece off the front page and lets the page choose again. */
  homeSlot: z.enum(HOME_SLOTS).nullable(),
  homeOrder: z.coerce.number().int().min(0).max(99).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/editorial/:id/home-slot - put a piece in a named place on the
 * front page, or take it off.
 *
 * Only one piece can lead. Setting a new one moves the old one aside rather
 * than refusing, because the desk's intent is obvious and making them clear the
 * old lead first would just be a second click.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Pick a position on the front page");
    const { homeSlot, homeOrder } = parsed.data;

    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!article) throw new HttpError(404, "Article not found");
    if (homeSlot && article.status !== "APPROVED") {
      throw new HttpError(409, "Publish the piece before giving it a place on the front page");
    }

    if (homeSlot === "LEAD") {
      await prisma.article.updateMany({
        where: { homeSlot: "LEAD", id: { not: id } },
        data: { homeSlot: null },
      });
    }

    const updated = await prisma.article.update({
      where: { id },
      data: { homeSlot, homeOrder: homeOrder ?? 0 },
      select: { id: true, homeSlot: true, homeOrder: true },
    });
    return Response.json({ article: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
