import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireAdmin } from "@/lib/rbac";
import { paymentSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { money } from "@/lib/format";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  status: z.enum(["PAID", "DECLINED"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * PATCH /api/payouts/:id - an admin answering a request.
 *
 * Admin and above only, the same bar as seeing payout details at all: an
 * editor must never see a contributor's bank account, and marking money as
 * sent is not an editorial decision.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Say whether it was paid or declined");
    const { status, note } = parsed.data;

    if (status === "DECLINED" && !note?.trim()) {
      throw new HttpError(422, "Tell the contributor why it was declined");
    }

    const existing = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "That request no longer exists");
    if (existing.status !== "PENDING") {
      throw new HttpError(409, `This request was already marked ${existing.status.toLowerCase()}`);
    }

    const settings = await paymentSettings();
    const request = await prisma.payoutRequest.update({
      where: { id },
      data: {
        status,
        decidedNote: note?.trim() || null,
        decidedById: admin.id,
        decidedAt: new Date(),
      },
    });

    await notify({
      userId: request.userId,
      kind: "PAYOUT",
      title:
        status === "PAID"
          ? `${money(request.amountCents, settings.currency)} has been sent to you`
          : "Your payout request was not approved",
      body: request.decidedNote ?? undefined,
      href: "/dashboard",
    });

    return Response.json({ request });
  } catch (err) {
    return errorResponse(err);
  }
}
