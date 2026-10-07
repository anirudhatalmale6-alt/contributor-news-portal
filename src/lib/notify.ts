import { prisma } from "@/lib/prisma";

type Kind = "PUBLISHED" | "REJECTED" | "ROLE" | "PAYOUT";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
};

/**
 * Tell somebody something happened.
 *
 * Deliberately never throws: a notification is a courtesy, and failing to write
 * one must not roll back the decision that caused it. The decision is the thing
 * that matters; the note about it is not.
 */
export async function notify(input: {
  userId: string;
  kind: Kind;
  title: string;
  body?: string;
  href?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    });
  } catch (err) {
    console.error("notification not written", err);
  }
}

/** A piece went live. */
export function notifyPublished(userId: string, title: string, href: string, payout: string) {
  return notify({
    userId,
    kind: "PUBLISHED",
    title: "Your article is published",
    body: `"${title}" is live on the site. Payout set to ${payout}.`,
    href,
  });
}

/** A piece came back for changes. */
export function notifyRejected(userId: string, title: string, href: string, note?: string | null) {
  return notify({
    userId,
    kind: "REJECTED",
    title: "An editor sent your article back",
    body: note?.trim()
      ? `"${title}": ${note.trim()}`
      : `"${title}" needs changes before it can be published.`,
    href,
  });
}

/** Somebody's role changed under them. */
export function notifyRole(userId: string, from: string, to: string) {
  const rising = ["CONTRIBUTOR", "EDITOR", "ADMIN", "SUPERADMIN"].indexOf(to) >
    ["CONTRIBUTOR", "EDITOR", "ADMIN", "SUPERADMIN"].indexOf(from);
  return notify({
    userId,
    kind: "ROLE",
    title: rising ? `You are now ${ROLE_LABEL[to] ?? to}` : `Your role is now ${ROLE_LABEL[to] ?? to}`,
    body: rising
      ? "You can now reach the newsroom screens from the top bar."
      : `Changed from ${ROLE_LABEL[from] ?? from}.`,
    href: rising && to !== "CONTRIBUTOR" ? "/editorial" : "/dashboard",
  });
}

/** How many unread notices somebody has. */
export function unreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
