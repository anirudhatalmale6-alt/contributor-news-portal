import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canChangeRole, errorResponse, HttpError, isOwner, requireStaff } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  role: z.enum(["SUPERADMIN", "ADMIN", "EDITOR", "CONTRIBUTOR"]).optional(),
  tier: z.enum(["GENERAL", "VERIFIED"]).optional(),
});

/**
 * PATCH /api/admin/users/:id - change someone's role or contributor tier.
 *
 * An editor may promote a contributor to editor and put them back; only the
 * owner can create admins, hand over the owner's seat, or touch another
 * senior account.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireStaff();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || (!parsed.data.role && !parsed.data.tier)) {
      return Response.json({ error: "Nothing to change" }, { status: 422 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!target) throw new HttpError(404, "No such account");

    if (parsed.data.role) {
      if (id === actor.id) {
        throw new HttpError(409, "You cannot change your own role");
      }
      if (!canChangeRole(actor.role, target.role, parsed.data.role)) {
        throw new HttpError(
          403,
          isOwner(actor.role)
            ? "That change is not allowed"
            : "Only the site owner can change admin or owner accounts",
        );
      }
    }

    // Flagging someone Verified is an editorial judgement, but it should not be
    // a way to edit a senior colleague's record.
    if (parsed.data.tier && !canChangeRole(actor.role, target.role, target.role)) {
      throw new HttpError(403, "Only the site owner can change that account");
    }

    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, tier: true },
    });
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
