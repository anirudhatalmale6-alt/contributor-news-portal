import { prisma } from "@/lib/prisma";
import { isStaff, type SessionUser } from "@/lib/rbac";

/**
 * Who may read a thread. Two rules, no more: you are on it, or it is addressed
 * to the newsroom and you are staff. A contributor can therefore never read a
 * conversation about somebody else.
 */
export function threadWhere(user: SessionUser) {
  const mine = { members: { some: { userId: user.id } } };
  return isStaff(user.role) ? { OR: [mine, { desk: true }] } : mine;
}

/** The count behind the Inbox badge: messages from other people since my last read. */
export async function unreadCount(user: SessionUser) {
  const threads = await prisma.inboxThread.findMany({
    where: threadWhere(user),
    select: {
      id: true,
      members: { where: { userId: user.id }, select: { lastReadAt: true } },
    },
  });
  if (threads.length === 0) return 0;

  const counts = await Promise.all(
    threads.map((t) =>
      prisma.inboxMessage.count({
        where: {
          threadId: t.id,
          senderId: { not: user.id },
          // A staff member reading a desk thread has no membership row until
          // they answer it, so treat "no row" as never read.
          ...(t.members[0]?.lastReadAt ? { createdAt: { gt: t.members[0].lastReadAt } } : {}),
        },
      }),
    ),
  );
  return counts.reduce((a, b) => a + b, 0);
}

/**
 * Marks a thread read for one person. Staff reading a desk thread get their
 * membership row created here, which is also what puts the thread in their own
 * list from then on.
 */
export async function markRead(threadId: string, userId: string) {
  await prisma.threadMember.upsert({
    where: { threadId_userId: { threadId, userId } },
    create: { threadId, userId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}

/** How a thread is labelled in a list: the other people on it, or "Newsroom". */
export function otherNames(
  members: { user: { id: string; name: string; role: string } }[],
  meId: string,
  desk: boolean,
) {
  const others = members.filter((m) => m.user.id !== meId).map((m) => m.user.name);
  if (desk && others.length === 0) return "Newsroom";
  if (others.length === 0) return "Just you";
  if (others.length <= 2) return others.join(", ");
  return `${others.slice(0, 2).join(", ")} +${others.length - 2}`;
}
