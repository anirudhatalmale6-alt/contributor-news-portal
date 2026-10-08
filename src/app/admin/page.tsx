import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isOwner, isStaff } from "@/lib/rbac";
import { money } from "@/lib/format";
import { paymentSettings, siteSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatCard } from "@/components/ui";
import { StaffNav } from "@/components/staff-nav";
import { SettingsForm } from "./settings-form";
import { SiteForm } from "./site-form";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  // Settings belong to the owner. Other staff land on the people list instead of
  // a dead end.
  if (!isOwner(user.role)) redirect(isStaff(user.role) ? "/people" : "/dashboard");

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

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="settings" />
        </div>

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
            adBannerHtml: site.adBannerHtml,
            adSquareHtml: site.adSquareHtml,
            adHomeHtmlEn: site.adHomeHtmlEn,
            adArticleHtmlEn: site.adArticleHtmlEn,
            adSectionHtmlEn: site.adSectionHtmlEn,
            adBannerHtmlEn: site.adBannerHtmlEn,
            adSquareHtmlEn: site.adSquareHtmlEn,
            banglaFont: site.banglaFont,
          }}
        />

      </main>
    </>
  );
}
