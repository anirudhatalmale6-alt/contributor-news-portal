import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { money } from "@/lib/format";
import { paymentSettings, siteSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatCard } from "@/components/ui";
import { maskedDestination } from "@/lib/payout";
import { UserTable } from "./user-table";
import { SettingsForm } from "./settings-form";
import { SiteForm } from "./site-form";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [users, settings, site, totals] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        accounts: { select: { provider: true } },
        payout: { select: { method: true, accountName: true, walletNumber: true, accountNumber: true, email: true } },
        _count: { select: { articles: true } },
      },
    }),
    paymentSettings(),
    siteSettings(),
    prisma.article.aggregate({
      where: { status: "APPROVED" },
      _sum: { payoutCents: true },
      _count: { _all: true },
    }),
  ]);

  const waiting = await prisma.article.count({ where: { status: "SUBMITTED" } });

  const sums = await prisma.article.groupBy({
    by: ["authorId"],
    where: { status: "APPROVED" },
    _sum: { payoutCents: true },
  });
  const earned = new Map(sums.map((s) => [s.authorId, s._sum.payoutCents ?? 0]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">Admin</h1>
            <p className="mt-1 text-sm text-ink-soft">
              User management, roles and payment settings. Articles waiting for a decision live in
              the Editorial queue.
            </p>
          </div>
          <Link
            href="/editorial"
            className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark"
          >
            Editorial queue
            {waiting > 0 ? (
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-navy">
                {waiting}
              </span>
            ) : null}
          </Link>
        </div>

        <section className="grid gap-3 py-6 sm:grid-cols-3">
          <StatCard label="Accounts" value={String(users.length)} />
          <StatCard label="Published articles" value={String(totals._count._all)} />
          <StatCard
            label="Committed payouts"
            value={money(totals._sum.payoutCents ?? 0, settings.currency)}
            accent
          />
        </section>

        <SettingsForm
          settings={{
            currency: settings.currency,
            defaultPayout: settings.defaultPayout,
            verifiedBonusPct: settings.verifiedBonusPct,
            payoutNote: settings.payoutNote,
            requireTranslation: settings.requireTranslation,
          }}
        />

        <SiteForm
          settings={{
            siteNameEn: site.siteNameEn,
            siteNameBn: site.siteNameBn,
            taglineEn: site.taglineEn,
            taglineBn: site.taglineBn,
            footerEn: site.footerEn,
            footerBn: site.footerBn,
            logoUrl: site.logoUrl,
            adsEnabled: site.adsEnabled,
            adHomeHtml: site.adHomeHtml,
            adArticleHtml: site.adArticleHtml,
            adSectionHtml: site.adSectionHtml,
          }}
        />

        <UserTable
          currency={settings.currency}
          meId={user.id}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            tier: u.tier,
            providers: u.accounts.map((a) => a.provider),
            payout: u.payout
              ? { method: u.payout.method, masked: maskedDestination(u.payout) }
              : null,
            articles: u._count.articles,
            earnedCents: earned.get(u.id) ?? 0,
          }))}
        />
      </main>
    </>
  );
}
