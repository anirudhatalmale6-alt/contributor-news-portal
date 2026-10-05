import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireRole } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  role: z.enum(["ADMIN", "EDITOR", "CONTRIBUTOR"]).optional(),
  tier: z.enum(["GENERAL", "VERIFIED"]).optional(),
});

/** PATCH /api/admin/users/:id - promote to Editor, flag as Verified Contributor, etc. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || (!parsed.data.role && !parsed.data.tier)) {
      return Response.json({ error: "Nothing to change" }, { status: 422 });
    }

    // Guard rail: an admin must not demote themselves out of the admin seat.
    if (id === admin.id && parsed.data.role && parsed.data.role !== "ADMIN") {
      throw new HttpError(409, "You cannot remove your own Admin role");
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
