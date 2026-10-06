import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { errorResponse, HttpError, requireUser } from "@/lib/rbac";
import { markRead, threadWhere } from "@/lib/inbox";

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/inbox/:id
 * Adds a reply. The visibility rule is the same one the pages use, so there is
 * only ever one definition of who may be in a conversation.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new HttpError(422, "Write something first");

    const thread = await prisma.inboxThread.findFirst({
      where: { id, ...threadWhere(user) },
      select: { id: true },
    });
    if (!thread) throw new HttpError(404, "Conversation not found");

    const [message] = await prisma.$transaction([
      prisma.inboxMessage.create({
        data: { threadId: id, senderId: user.id, body: parsed.data.body },
        select: { id: true, body: true, createdAt: true },
      }),
      prisma.inboxThread.update({ where: { id }, data: { lastMessageAt: new Date() } }),
    ]);

    // Answering a desk thread puts it in my own list from now on.
    await markRead(id, user.id);
    return Response.json({ message }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
