import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { longDate, money, timeAgo } from "@/lib/format";
import { paymentSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatCard, StatusPill, TierBadge } from "@/components/ui";
import { maskedDestination, methodLabel } from "@/lib/payout";
import { NewDraftButton } from "./new-draft-button";

export const metadata = { title: "My desk" };

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [articles, settings, payout] = await Promise.all([
    prisma.article.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        media: { select: { id: true, kind: true } },
        reviews: {
          where: { action: { in: ["APPROVED", "REJECTED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { editor: { select: { name: true } } },
        },
      },
    }),
    paymentSettings(),
    prisma.payoutProfile.findUnique({ where: { userId: user.id } }),
  ]);

  const published = articles.filter((a) => a.status === "APPROVED");
  const totalCents = published.reduce((sum, a) => sum + a.payoutCents, 0);
  const inReview = articles.filter((a) => a.status === "SUBMITTED").length;
  const needsWork = articles.filter((a) => a.status === "REJECTED").length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">
              {user.name.split(" ")[0]}&rsquo;s desk
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={user.tier} role={user.role} />
              <span className="text-xs text-ink-soft">{user.email}</span>
            </div>
          </div>
          <NewDraftButton />
        </div>

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total earnings"
            value={money(totalCents, settings.currency)}
            hint="Across every published piece"
            accent
          />
          <StatCard label="Published" value={String(published.length)} hint="Live on the site" />
          <StatCard label="In review" value={String(inReview)} hint="Waiting on an editor" />
          <StatCard
            label="Changes requested"
            value={String(needsWork)}
            hint={needsWork ? "Edit and resubmit" : "Nothing to fix"}
          />
        </section>

        <p className="-mt-2 mb-4 text-xs text-ink-soft">{settings.payoutNote}</p>

        <section
          className={`mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
            payout ? "border-line bg-paper" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div>
            <p className="text-sm font-medium">
              {payout ? "Payment details" : "Add your payment details"}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {payout
                ? `${methodLabel(payout.method)} · ${payout.accountName} · ${maskedDestination(payout)}`
                : "We cannot send your earnings anywhere until you tell us where. Takes a minute."}
            </p>
          </div>
          <Link
            href="/dashboard/payout"
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              payout
                ? "border border-line hover:bg-paper-soft"
                : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            {payout ? "Update" : "Add payment details"}
          </Link>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
            My articles
          </h2>

          {articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper-soft p-8 text-center">
              <p className="text-sm text-ink-soft">
                Nothing here yet. Start your first piece and save it as a draft whenever you like.
              </p>
              <div className="mt-4 flex justify-center">
                <NewDraftButton />
              </div>
            </div>
          ) : (
            <ul className="grid gap-3">
              {articles.map((a) => {
                const note = a.reviews[0];
                const editable = a.status === "DRAFT" || a.status === "REJECTED";
                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-line p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={a.status} />
                          <span className="text-xs text-ink-soft">
                            {a.category} · edited {timeAgo(a.updatedAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate font-serif text-lg font-bold">
                          {a.title || "Untitled draft"}
                        </p>
                        {a.dek ? (
                          <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{a.dek}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-soft">
                          {a.media.length} attachment{a.media.length === 1 ? "" : "s"}
                          {a.publishedAt ? ` · published ${longDate(a.publishedAt)}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {a.status === "APPROVED" ? (
                          <span className="font-serif text-lg font-bold text-brand-dark tabular-nums">
                            {a.payoutCents > 0
                              ? money(a.payoutCents, settings.currency)
                              : "payout pending"}
                          </span>
                        ) : null}
                        <div className="flex gap-2">
                          {a.status === "APPROVED" ? (
                            <Link
                              href={`/article/${a.slug}`}
                              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-soft"
                            >
                              View live
                            </Link>
                          ) : null}
                          <Link
                            href={`/dashboard/write/${a.id}`}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                              editable
                                ? "bg-ink text-white hover:bg-navy-dark"
                                : "border border-line hover:bg-paper-soft"
                            }`}
                          >
                            {editable ? "Continue editing" : "Open"}
                          </Link>
                        </div>
                      </div>
                    </div>

                    {note?.note ? (
                      <div
                        className={`mt-3 rounded-lg border p-3 text-sm ${
                          note.action === "REJECTED"
                            ? "border-rose-200 bg-rose-50 text-rose-900"
                            : "border-emerald-200 bg-emerald-50 text-emerald-900"
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide">
                          {note.action === "REJECTED" ? "Editor asked for changes" : "Editor note"}
                          {note.editor ? ` · ${note.editor.name}` : ""}
                        </p>
                        <p className="mt-1">{note.note}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
