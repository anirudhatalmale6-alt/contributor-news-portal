import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { payableFor } from "@/lib/earnings";
import { paymentSettings } from "@/lib/settings";
import { destinationOf, methodLabel } from "@/lib/payout";
import { notify } from "@/lib/notify";
import { money } from "@/lib/format";

const schema = z.object({ note: z.string().trim().max(500).optional() });

/**
 * POST /api/payouts - a contributor asking to be paid.
 *
 * Everything that decides whether the request is allowed is checked here, on
 * the server, and the amount is read here too. The browser is told what is
 * payable so it can show the right thing, but it never gets to say what it is.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const note = parsed.success ? parsed.data.note : undefined;

    const [settings, payable, profile, pending] = await Promise.all([
      paymentSettings(),
      payableFor(user.id),
      prisma.payoutProfile.findUnique({ where: { userId: user.id } }),
      prisma.payoutRequest.findFirst({ where: { userId: user.id, status: "PENDING" } }),
    ]);

    if (pending) {
      throw new HttpError(
        409,
        "You already have a request waiting. The desk will answer that one first.",
      );
    }
    if (!profile) {
      throw new HttpError(
        422,
        "Add your payment details first - the desk has nowhere to send this.",
      );
    }
    if (payable.availableCents < settings.minPayoutCents) {
      throw new HttpError(
        422,
        `You can ask to be paid once you have ${money(
          settings.minPayoutCents,
          settings.currency,
        )} available. You have ${money(payable.availableCents, settings.currency)}.`,
      );
    }

    const request = await prisma.payoutRequest.create({
      data: {
        userId: user.id,
        amountCents: payable.availableCents,
        // Copied, not referenced: see the note on the model. The desk must be
        // able to see what it was asked to pay even if the profile changes.
        method: profile.method,
        accountName: profile.accountName,
        destination: destinationOf(profile),
        note: note || null,
      },
    });

    // Every admin and the owner, so a request is never waiting on one person.
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPERADMIN"] }, suspendedAt: null },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        notify({
          userId: admin.id,
          kind: "PAYOUT",
          title: `${user.name} has asked to be paid ${money(
            request.amountCents,
            settings.currency,
          )}`,
          body: `${methodLabel(profile.method)} · ${profile.accountName}`,
          href: "/payouts",
        }),
      ),
    );

    return Response.json({ request }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
