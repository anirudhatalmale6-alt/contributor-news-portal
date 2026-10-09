import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { longDate, money, timeAgo } from "@/lib/format";
import { deskLocale, paymentSettings, siteSettings } from "@/lib/settings";
import { earningsFor, payableFor } from "@/lib/earnings";
import { localeDate } from "@/lib/i18n";
import { text } from "@/lib/ui-text";
import { banglaFontCss } from "@/lib/fonts";
import { noticesFor } from "@/lib/notices";
import { NoticeBoard } from "./notice-board";
import { SiteFooter } from "@/components/site-footer";
import { RequestPayout } from "./request-payout";
import { Notifications } from "@/components/notifications";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
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
  // One resolver decides this figure, so the desk and the newsroom can never
  // disagree about what somebody is owed.
  const [earnings, payable, pendingRequest, notices, notes] = await Promise.all([
    earningsFor(user.id),
    payableFor(user.id),
    prisma.payoutRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    noticesFor(user.id),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);
  // Every word on this screen comes from the Wording screen, in whichever
  // language the owner set for the desk.
  const locale = await deskLocale();
  const s = (key: string, vars?: Record<string, string | number>) => text(key, locale, vars);
  // A Bangla desk needs the Bangla face as well as the Bangla words: the serif
  // the headings use has no Bengali glyphs at all, so it would draw boxes.
  const site = locale === "BN" ? await siteSettings() : null;

  const totalCents = earnings.totalCents;
  const inReview = articles.filter((a) => a.status === "SUBMITTED").length;
  const needsWork = articles.filter((a) => a.status === "REJECTED").length;

  return (
    <>
      <SiteHeader />
      <main
        lang={locale === "BN" ? "bn" : undefined}
        style={
          site
            ? ({ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties)
            : undefined
        }
        className="mx-auto max-w-5xl px-4 pb-16"
      >
        <div className="pt-4">
          <StaffNav user={user} current="desk" />
        </div>

        <div className="pt-2">
          <NoticeBoard notices={notices.map((n) => ({ id: n.id, body: n.body, forEveryone: n.forEveryone }))} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">
              {s("desk.title", { name: user.name.split(" ")[0] })}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TierBadge tier={user.tier} role={user.role} />
              <span className="text-xs text-ink-soft">{user.email}</span>
              <Link
                href="/dashboard/profile"
                className="text-xs font-medium text-brand hover:underline"
              >
                {s("desk.editProfile")}
              </Link>
            </div>
          </div>
          <NewDraftButton label={s("desk.newPiece")} busyLabel={s("desk.opening")} />
        </div>

        <Notifications
          words={{
            updates: s("desk.updates"),
            unreadNew: s("desk.unreadNew", { n: "{n}" }),
            markAllRead: s("desk.markAllRead"),
            marking: s("desk.marking"),
          }}
          notes={notes.map((n) => ({
            id: n.id,
            kind: n.kind,
            title: n.title,
            body: n.body,
            href: n.href,
            read: Boolean(n.readAt),
            createdAt: n.createdAt.toISOString(),
          }))}
        />

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={s("desk.totalEarnings")}
            value={money(totalCents, settings.currency)}
            // A contributor adding up their own articles and getting a different
            // number would reasonably think the site was wrong.
            hint={
              earnings.adjustmentCents
                ? `${money(earnings.articleCents, settings.currency)} from articles, ${
                    earnings.adjustmentCents > 0 ? "plus" : "less"
                  } ${money(Math.abs(earnings.adjustmentCents), settings.currency)} adjusted by the desk`
                : s("desk.acrossEvery")
            }
            accent
          />
          <StatCard
            label={s("desk.published")}
            value={String(published.length)}
            hint={s("desk.liveOnSite")}
          />
          <StatCard
            label={s("desk.inReview")}
            value={String(inReview)}
            hint={s("desk.waitingEditor")}
          />
          <StatCard
            label={s("desk.changesRequested")}
            value={String(needsWork)}
            hint={needsWork ? s("desk.editResubmit") : s("desk.nothingToFix")}
          />
        </section>

        <p className="-mt-2 mb-4 text-xs text-ink-soft">{settings.payoutNote}</p>

        <div className="mb-4">
          <RequestPayout
            available={money(payable.availableCents, settings.currency)}
            minimum={money(settings.minPayoutCents, settings.currency)}
            hasDetails={Boolean(payout)}
            canRequest={
              Boolean(payout) && !pendingRequest && payable.availableCents >= settings.minPayoutCents
            }
            pending={
              pendingRequest
                ? {
                    amount: money(pendingRequest.amountCents, settings.currency),
                    since: localeDate(pendingRequest.createdAt, "EN"),
                  }
                : null
            }
          />
        </div>

        <section
          className={`mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
            payout ? "border-line bg-paper" : "border-amber-200 bg-amber-50"
          }`}
        >
          <div>
            <p className="text-sm font-medium">
              {payout ? s("desk.paymentDetails") : s("desk.addPaymentTitle")}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {payout
                ? `${methodLabel(payout.method)} · ${payout.accountName} · ${maskedDestination(payout)}`
                : s("desk.noDestination")}
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
            {payout ? s("desk.update") : s("desk.addDetails")}
          </Link>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
            {s("desk.myArticles")}
          </h2>

          {articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper-soft p-8 text-center">
              <p className="text-sm text-ink-soft">
                {s("desk.nothingYet")}
              </p>
              <div className="mt-4 flex justify-center">
                <NewDraftButton label={s("desk.newPiece")} busyLabel={s("desk.opening")} />
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
                            {a.category} · {s("desk.edited", { when: timeAgo(a.updatedAt) })}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate font-serif text-lg font-bold">
                          {a.title || s("desk.untitled")}
                        </p>
                        {a.dek ? (
                          <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{a.dek}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-ink-soft">
                          {a.media.length === 1
                            ? s("desk.attachment", { n: 1 })
                            : s("desk.attachments", { n: a.media.length })}
                          {a.publishedAt
                            ? ` · ${s("desk.publishedOn", { date: longDate(a.publishedAt) })}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {a.status === "APPROVED" ? (
                          <span className="font-serif text-lg font-bold text-brand-dark tabular-nums">
                            {a.payoutCents > 0
                              ? money(a.payoutCents, settings.currency)
                              : s("desk.payoutPending")}
                          </span>
                        ) : null}
                        <div className="flex gap-2">
                          {a.status === "APPROVED" ? (
                            <Link
                              href={`/article/${a.slug}`}
                              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-soft"
                            >
                              {s("desk.viewLive")}
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
                            {editable ? s("desk.continueEditing") : s("desk.open")}
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
                          {note.action === "REJECTED" ? s("desk.editorChanges") : s("desk.editorNote")}
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
      <SiteFooter />
    </>
  );
}
