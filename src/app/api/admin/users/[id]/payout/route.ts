import { prisma } from "@/lib/prisma";
import { errorResponse, requireOwner } from "@/lib/rbac";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/users/:id/payout
 * Full payment details for the person actually sending the money. ADMIN only -
 * an Editor who can set payouts still never sees an account number.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireOwner();
    const { id } = await params;
    const payout = await prisma.payoutProfile.findUnique({ where: { userId: id } });
    const user = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true },
    });
    return Response.json({ user, payout });
  } catch (err) {
    return errorResponse(err);
  }
}
