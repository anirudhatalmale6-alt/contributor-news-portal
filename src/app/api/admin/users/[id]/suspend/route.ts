import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canChangeRole, errorResponse, HttpError, requireStaff } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/admin/users/:id/suspend
 *
 * Suspending stops someone signing in or writing; it does not unpublish what
 * the desk already approved. Only someone senior can do it, never to
 * themselves, and the reason is kept so the decision can be explained later.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: "suspended must be true or false" }, { status: 422 });
    }
    const { suspended, reason } = parsed.data;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, suspendedAt: true },
    });
    if (!target) throw new HttpError(404, "No such account");
    if (target.id === actor.id) throw new HttpError(409, "You cannot suspend yourself");
    if (!canChangeRole(actor.role, target.role, target.role)) {
      throw new HttpError(403, "You cannot suspend that account");
    }
    if (suspended && !reason?.trim()) {
      throw new HttpError(422, "Give a reason, so the decision can be explained");
    }

    const user = await prisma.user.update({
      where: { id },
      data: suspended
        ? { suspendedAt: new Date(), suspendedReason: reason!.trim(), suspendedById: actor.id }
        : { suspendedAt: null, suspendedReason: null, suspendedById: null },
      select: { id: true, name: true, suspendedAt: true, suspendedReason: true },
    });

    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
