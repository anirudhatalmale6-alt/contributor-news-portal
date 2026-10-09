import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/rbac";
import { createResetLink } from "@/lib/password-reset";
import { mailReady, sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";

const schema = z.object({ email: z.string().trim().email() });

/**
 * POST /api/auth/forgot - "I have forgotten my password".
 *
 * Always answers the same way, whether or not the address belongs to anybody.
 * Telling a stranger which email addresses have accounts is a way of handing
 * out a list of your contributors.
 *
 * If the site has a mail server the link is emailed. If it has not, the desk
 * is told instead, so an admin can pass the link on by phone or WhatsApp -
 * which is how a Bangladeshi newsroom usually reaches a stringer anyway.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return Response.json({ error: "Enter the email address on your account" }, { status: 422 });
    }
    const email = parsed.data.email.toLowerCase();

    // Case-insensitive: an account made as Rahim@… must be findable as rahim@…
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" }, suspendedAt: null },
      select: { id: true, name: true, email: true },
    });

    if (user) {
      const base = process.env.SITE_URL || new URL(req.url).origin;
      const link = await createResetLink(user.id, base);

      if (mailReady()) {
        await sendMail({
          to: user.email,
          subject: "Set a new password for The Document",
          text:
            `Somebody asked to reset the password for your account.\n\n${link}\n\n` +
            `The link works once and stops working in an hour. If this was not you, ` +
            `ignore this message - nothing has changed.`,
        });
      } else {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUPERADMIN"] }, suspendedAt: null },
          select: { id: true },
        });
        await Promise.all(
          admins.map((admin) =>
            notify({
              userId: admin.id,
              kind: "ROLE",
              title: `${user.name} cannot sign in and needs a new password`,
              body: `Send them this link, it works once and lasts an hour: ${link}`,
            }),
          ),
        );
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
