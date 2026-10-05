import { prisma } from "@/lib/prisma";
import { errorResponse, requireUser } from "@/lib/rbac";
import { payoutSchema } from "@/lib/payout";

/**
 * The contributor's own payment details.
 * Only the owner reads or writes here; an Admin uses the admin endpoint.
 * Editors have no route to these numbers at all.
 */

/** GET /api/profile/payout */
export async function GET() {
  try {
    const user = await requireUser();
    const payout = await prisma.payoutProfile.findUnique({ where: { userId: user.id } });
    return Response.json({ payout });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT /api/profile/payout - create or replace. */
export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const parsed = payoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Check the details", issues: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const d = parsed.data;
    const data = {
      method: d.method,
      accountName: d.accountName,
      walletNumber: d.walletNumber?.replace(/[\s-]/g, "") || null,
      bankName: d.bankName || null,
      branch: d.branch || null,
      accountNumber: d.accountNumber || null,
      routingNumber: d.routingNumber || null,
      email: d.email || null,
      country: d.country || "Bangladesh",
      note: d.note || null,
    };

    const payout = await prisma.payoutProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
    return Response.json({ payout });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/profile/payout */
export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.payoutProfile.deleteMany({ where: { userId: user.id } });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
