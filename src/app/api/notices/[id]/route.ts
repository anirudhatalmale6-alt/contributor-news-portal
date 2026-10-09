import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, isAdmin, requireUser } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/notices/:id - "I have read this".
 *
 * Recorded per reader rather than by taking the notice down, so one
 * contributor closing a notice meant for everybody does not take it off
 * everybody else's screen.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.retiredAt) throw new HttpError(404, "That notice is gone");
    // A notice addressed to one person cannot be dismissed by another.
    if (notice.userId && notice.userId !== user.id) throw new HttpError(403, "Not your notice");

    await prisma.noticeDismissal.upsert({
      where: { noticeId_userId: { noticeId: id, userId: user.id } },
      create: { noticeId: id, userId: user.id },
      update: {},
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/notices/:id - the desk taking its own notice down for good. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    if (!isAdmin(user.role)) throw new HttpError(403, "Admins only");
    const { id } = await params;
    await prisma.notice.update({ where: { id }, data: { retiredAt: new Date() } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
