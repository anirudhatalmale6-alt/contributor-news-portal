import { errorResponse, HttpError, requireOwner } from "@/lib/rbac";
import { mailReady, sendMail } from "@/lib/mail";

/**
 * POST /api/admin/mailbox/test - sends one email to the owner's own address,
 * so he sees with his own eyes that mail from the site arrives (and whether it
 * lands in spam) before a contributor depends on it.
 */
export async function POST() {
  try {
    const owner = await requireOwner();
    if (!(await mailReady())) throw new HttpError(409, "Set up the mailbox first");
    try {
      await sendMail({
        to: owner.email,
        subject: "Test from The Document",
        text:
          "This is a test from your site's Email sending settings. If you are reading it, " +
          "password reset links will reach your contributors the same way.",
      });
    } catch (err) {
      throw new HttpError(502, `The mail server would not send it: ${err instanceof Error ? err.message : "unknown error"}`);
    }
    return Response.json({ ok: true, message: `Sent to ${owner.email}. Check the inbox, and the spam folder.` });
  } catch (err) {
    return errorResponse(err);
  }
}
