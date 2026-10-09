import { prisma } from "@/lib/prisma";
import { siteSettings } from "@/lib/settings";
import { z } from "zod";
import { errorResponse, HttpError, isStaff, requireUser } from "@/lib/rbac";

const schema = z.object({
  subject: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(4000),
  /** Omitted by a contributor: their thread always goes to the whole desk. */
  toUserId: z.string().trim().optional(),
  articleId: z.string().trim().optional(),
});

/**
 * POST /api/inbox
 * Starts a conversation. A contributor can only write to the newsroom; staff
 * can write to a named person as well.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new HttpError(422, "Add a subject and a message");
    }
    const { subject, body, toUserId, articleId } = parsed.data;
    const staff = isStaff(user.role);

    // Staff may always address an individual. A contributor may only write to
    // another contributor when the owner has switched that on - it is off
    // until he does, because most contributors here do not know each other.
    // Writing to the newsroom is never blocked either way.
    let recipient: { id: string } | null = null;
    if (toUserId) {
      const target = await prisma.user.findUnique({
        where: { id: toUserId },
        select: { id: true, role: true, suspendedAt: true },
      });
      if (!target) throw new HttpError(404, "That person no longer has an account");

      if (staff) {
        recipient = { id: target.id };
      } else {
        const site = await siteSettings();
        if (!site.contributorMessaging) {
          throw new HttpError(
            403,
            "Messages between contributors are switched off. You can still write to the newsroom.",
          );
        }
        if (target.suspendedAt) throw new HttpError(403, "That account is suspended");
        recipient = { id: target.id };
      }
    }

    // An attached article has to belong to the person writing, unless they are
    // staff - otherwise a contributor could fish for someone else's story id.
    if (articleId) {
      const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: { authorId: true },
      });
      if (!article) throw new HttpError(404, "That article no longer exists");
      if (!staff && article.authorId !== user.id) throw new HttpError(403, "Not your article");
    }

    // The sender has obviously read their own message; the recipient has not.
    const members: { userId: string; lastReadAt: Date | null }[] = [
      { userId: user.id, lastReadAt: new Date() },
    ];
    if (recipient && recipient.id !== user.id) {
      members.push({ userId: recipient.id, lastReadAt: null });
    }

    const thread = await prisma.inboxThread.create({
      data: {
        subject,
        desk: !recipient,
        articleId: articleId ?? null,
        startedById: user.id,
        members: { create: members.map((m) => ({ userId: m.userId, lastReadAt: m.lastReadAt })) },
        messages: { create: { senderId: user.id, body } },
      },
      select: { id: true },
    });

    return Response.json({ thread }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
