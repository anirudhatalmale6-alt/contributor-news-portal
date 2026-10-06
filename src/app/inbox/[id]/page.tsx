import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { markRead, otherNames, threadWhere } from "@/lib/inbox";
import { ReplyForm } from "./reply-form";

export const metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
};

function stamp(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/inbox/${id}`);

  const thread = await prisma.inboxThread.findFirst({
    where: { id, ...threadWhere(user) },
    select: {
      id: true,
      subject: true,
      desk: true,
      createdAt: true,
      article: { select: { id: true, title: true, slug: true, status: true } },
      members: { select: { user: { select: { id: true, name: true, role: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderId: true,
          sender: { select: { name: true, role: true } },
        },
      },
    },
  });
  if (!thread) notFound();

  // Opening the page is what clears the badge.
  await markRead(thread.id, user.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="inbox" />
        </div>

        <Link href="/inbox" className="text-sm text-ink-soft hover:text-ink">
          &larr; All conversations
        </Link>

        <h1 className="mt-2 font-serif text-2xl font-bold">{thread.subject}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {otherNames(thread.members, user.id, thread.desk)}
          {thread.desk ? " · every editor can read and answer this" : ""}
        </p>

        {thread.article ? (
          <p className="mt-2 text-sm">
            About{" "}
            <Link
              href={
                isStaff(user.role)
                  ? `/editorial/${thread.article.id}`
                  : `/dashboard/write/${thread.article.id}`
              }
              className="font-medium text-brand hover:underline"
            >
              {thread.article.title}
            </Link>
          </p>
        ) : null}

        <ol className="mt-5 grid gap-3">
          {thread.messages.map((m) => {
            const mine = m.senderId === user.id;
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-xl border p-3.5 ${
                  mine ? "ml-auto border-navy/30 bg-navy/5" : "border-line bg-paper-soft"
                }`}
              >
                <p className="text-xs text-ink-soft">
                  <span className="font-semibold text-ink">
                    {mine ? "You" : (m.sender?.name ?? "Removed account")}
                  </span>
                  {m.sender && !mine ? ` · ${ROLE_LABEL[m.sender.role] ?? m.sender.role}` : ""} ·{" "}
                  {stamp(m.createdAt)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            );
          })}
        </ol>

        <ReplyForm threadId={thread.id} />
      </main>
    </>
  );
}
