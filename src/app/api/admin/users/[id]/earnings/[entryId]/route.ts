import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { earningsFor } from "@/lib/earnings";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

/**
 * DELETE: take a correction back out.
 *
 * This is how a mistyped entry is "edited": remove it and add the right one.
 * Removing is restricted to the entry belonging to the person named in the URL,
 * so a stray id cannot reach into somebody else's ledger.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id, entryId } = await params;

    const entry = await prisma.earningAdjustment.findFirst({
      where: { id: entryId, userId: id },
      select: { id: true, amountCents: true },
    });
    if (!entry) throw new HttpError(404, "That entry is not on this person's ledger");

    // Pulling a bonus back out must not leave the total negative either.
    const before = await earningsFor(id);
    if (before.totalCents - entry.amountCents < 0) {
      throw new HttpError(422, "Removing that entry would take the total below zero");
    }

    await prisma.earningAdjustment.delete({ where: { id: entryId } });
    return Response.json({ totals: await earningsFor(id) });
  } catch (err) {
    return errorResponse(err);
  }
}
