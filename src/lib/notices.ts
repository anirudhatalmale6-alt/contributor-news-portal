import { prisma } from "@/lib/prisma";

/**
 * The notices this person has not yet closed.
 *
 * Both kinds come back together - the ones for everybody and the ones written
 * for them alone - because a reader does not care which is which. Newest last,
 * so a stack reads top to bottom in the order it was written.
 */
export async function noticesFor(userId: string) {
  const rows = await prisma.notice.findMany({
    where: {
      retiredAt: null,
      OR: [{ userId: null }, { userId }],
      // Not already closed by this reader.
      dismissals: { none: { userId } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, body: true, userId: true, createdAt: true },
  });
  return rows.map((n) => ({ ...n, forEveryone: n.userId === null }));
}
