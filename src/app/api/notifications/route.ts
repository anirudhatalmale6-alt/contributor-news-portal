import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/rbac";

/** POST /api/notifications - mark everything of mine as read. */
export async function POST() {
  try {
    const user = await requireUser();
    const { count } = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return Response.json({ cleared: count });
  } catch (err) {
    return errorResponse(err);
  }
}
