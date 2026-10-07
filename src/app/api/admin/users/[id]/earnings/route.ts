import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, isOwner, requireAdmin } from "@/lib/rbac";
import { earningsFor } from "@/lib/earnings";

const schema = z.object({
  /** Signed minor units: positive is a bonus, negative voids an earning. */
  amountCents: z.coerce.number().int().refine((n) => n !== 0, "Enter an amount"),
  reason: z.string().trim().min(3).max(300),
});

type Ctx = { params: Promise<{ id: string }> };

/** GET: the ledger for one contributor, newest first. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const [entries, totals] = await Promise.all([
      prisma.earningAdjustment.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amountCents: true,
          reason: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      }),
      earningsFor(id),
    ]);
    return Response.json({ entries, totals });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST: add a correction.
 *
 * Nothing is edited in place. A bonus and a deduction are both entries, so the
 * reason a total moved stays readable months later - which is the whole point
 * when the reason is "this piece turned out to be fabricated".
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the amount and reason");
    }
    const { amountCents, reason } = parsed.data;

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) throw new HttpError(404, "That person no longer has an account");

    // An admin cannot write their own cheque. The owner's own books are the
    // owner's business, so only they are exempt.
    if (actor.id === id && !isOwner(actor.role)) {
      throw new HttpError(403, "You cannot change your own earnings");
    }

    // A deduction cannot take someone below zero: the newsroom can cancel what
    // it owes, not invent a debt.
    const before = await earningsFor(id);
    if (before.totalCents + amountCents < 0) {
      throw new HttpError(
        422,
        `That would take the total below zero. They have ${(before.totalCents / 100).toFixed(2)} to take from.`,
      );
    }

    await prisma.earningAdjustment.create({
      data: { userId: id, amountCents, reason, createdById: actor.id },
    });

    return Response.json({ totals: await earningsFor(id) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
