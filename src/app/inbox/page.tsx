import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { siteSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { otherNames, threadWhere } from "@/lib/inbox";
import { NewThread } from "./new-thread";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

function when(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Every conversation this person is allowed to see, newest activity first. */
export default async function InboxPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/inbox");
  const staff = isStaff(user.role);

  const threads = await prisma.inboxThread.findMany({
    where: threadWhere(user),
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: {
      id: true,
      subject: true,
      desk: true,
      lastMessageAt: true,
      article: { select: { id: true, title: true } },
      members: {
        select: { userId: true, lastReadAt: true, user: { select: { id: true, name: true, role: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true, sender: { select: { name: true } } },
      },
      _count: { select: { messages: true } },
    },
  });

  // Unread is per person: anything newer than my own last read, from anyone else.
  const unread = await Promise.all(
    threads.map((t) => {
      const mine = t.members.find((m) => m.userId === user.id);
      return prisma.inboxMessage.count({
        where: {
          threadId: t.id,
          senderId: { not: user.id },
          ...(mine?.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
        },
      });
    }),
  );

  // Staff pick anyone. A contributor writes to the desk, and may also write to
  // another contributor when the owner has switched that on in Settings. Even
  // then they get names only - a contributor never sees another's email here.
  const site = await siteSettings();
  const peers = !staff && site.contributorMessaging;
  const people = staff
    ? await prisma.user.findMany({
        where: { id: { not: user.id }, suspendedAt: null },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, role: true },
      })
    : peers
      ? (
          await prisma.user.findMany({
            where: { id: { not: user.id }, suspendedAt: null, role: "CONTRIBUTOR" },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true },
          })
        ).map((p) => ({ ...p, email: "" }))
      : [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="inbox" />
        </div>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Inbox</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {staff
            ? "Messages with contributors and colleagues. Anything addressed to the newsroom is visible to every editor, so a question never waits on one person."
            : "Talk to the newsroom here. Editors can see your messages and will reply on this page."}
        </p>

        <NewThread people={people} canChoosePerson={staff || peers} />

        <ul className="mt-6 grid gap-2">
          {threads.length === 0 ? (
            <li className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
              No conversations yet.
            </li>
          ) : null}

          {threads.map((t, i) => (
            <li key={t.id}>
              <Link
                href={`/inbox/${t.id}`}
                className={`block rounded-xl border p-4 transition hover:border-navy ${
                  unread[i] ? "border-navy/40 bg-paper-soft" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-medium">{t.subject}</p>
                  {unread[i] ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                      {unread[i]} new
                    </span>
                  ) : null}
                  {t.desk ? (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-soft">
                      Newsroom
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-ink-soft">{when(t.lastMessageAt)}</span>
                </div>

                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
                  {t.messages[0] ? (
                    <>
                      <span className="font-medium text-ink">
                        {t.messages[0].senderId === user.id
                          ? "You"
                          : (t.messages[0].sender?.name ?? "Someone")}
                        :
                      </span>{" "}
                      {t.messages[0].body}
                    </>
                  ) : null}
                </p>

                <p className="mt-1.5 text-xs text-ink-soft">
                  {otherNames(t.members, user.id, t.desk)} · {t._count.messages} message
                  {t._count.messages === 1 ? "" : "s"}
                  {t.article ? ` · about "${t.article.title}"` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
