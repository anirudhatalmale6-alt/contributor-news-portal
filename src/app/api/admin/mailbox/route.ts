import { z } from "zod";
import { errorResponse, HttpError, requireOwner } from "@/lib/rbac";
import { clearMailbox, mailboxSummary, mailboxWorks, saveMailbox } from "@/lib/mail";

const schema = z.object({
  host: z.string().trim().min(3).max(200),
  port: z.coerce.number().int().refine((p) => [25, 465, 587, 2525].includes(p), "Use port 587 or 465"),
  user: z.string().trim().email("The mailbox is an email address, like no-reply@thedocument.net").max(200),
  pass: z.string().min(1, "Paste the mailbox password").max(400),
  fromName: z.string().trim().min(1).max(80).default("The Document"),
});

/**
 * PUT /api/admin/mailbox - the mailbox the site sends from.
 *
 * Logs in to the mail server with the details before keeping them, sending
 * nothing, so a wrong password shows up here and not when a contributor is
 * locked out. Owner only; the password never comes back.
 */
export async function PUT(req: Request) {
  try {
    await requireOwner();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Check the mailbox details");
    const m = parsed.data;

    const check = await mailboxWorks(m);
    if (!check.ok) throw new HttpError(422, check.reason);

    await saveMailbox(m);
    return Response.json({
      ok: true,
      message: `Saved. The mail server accepted ${m.user}. Send yourself a test to be sure it arrives.`,
      summary: await mailboxSummary(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/admin/mailbox - stop sending; reset links go to the desk again. */
export async function DELETE() {
  try {
    await requireOwner();
    await clearMailbox();
    return Response.json({ ok: true, summary: await mailboxSummary() });
  } catch (err) {
    return errorResponse(err);
  }
}
