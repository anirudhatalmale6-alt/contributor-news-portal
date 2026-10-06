import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { money, timeAgo } from "@/lib/format";
import { paymentSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatCard, StatusPill, TierBadge } from "@/components/ui";

export const metadata = { title: "Editorial queue" };

const TABS = [
  { key: "SUBMITTED", label: "Awaiting review" },
  { key: "APPROVED", label: "Published" },
  { key: "REJECTED", label: "Sent back" },
  { key: "ALL", label: "Everything" },
] as const;

export default async function EditorialPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/dashboard");

  const { status = "SUBMITTED" } = await searchParams;
  const where =
    status === "ALL"
      ? {}
      : { status: status as "SUBMITTED" | "APPROVED" | "REJECTED" | "DRAFT" };

  const [articles, settings, counts] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ submittedAt: "asc" }, { updatedAt: "desc" }],
      include: {
        author: { select: { name: true, tier: true, role: true } },
        media: { select: { id: true, kind: true } },
        translations: { select: { locale: true } },
      },
    }),
    paymentSettings(),
    prisma.article.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const paidOut = await prisma.article.aggregate({
    where: { status: "APPROVED" },
    _sum: { payoutCents: true },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">Editorial queue</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Signed in as {user.name} · {user.role === "ADMIN" ? "Admin" : "Editor"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
            >
              My writing desk
            </Link>
            {user.role === "ADMIN" ? (
              <Link
                href="/admin"
                className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
              >
                Admin settings
              </Link>
            ) : null}
          </div>
        </div>

        <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Awaiting review"
            value={String(countOf("SUBMITTED"))}
            hint="Oldest first"
            accent
          />
          <StatCard label="Published" value={String(countOf("APPROVED"))} />
          <StatCard label="Sent back" value={String(countOf("REJECTED"))} />
          <StatCard
            label="Assigned payouts"
            value={money(paidOut._sum.payoutCents ?? 0, settings.currency)}
            hint="Across all published work"
          />
        </section>

        <div className="flex flex-wrap gap-2 border-b border-line pb-4">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/editorial?status=${t.key}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                t.key === status
                  ? "border-navy bg-navy text-white"
                  : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
              {t.key !== "ALL" ? ` (${countOf(t.key)})` : ""}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">Nothing in this view.</p>
        ) : (
          <ul className="grid gap-3 pt-5">
            {articles.map((a) => (
              <li key={a.id} className="rounded-xl border border-line p-4 hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={a.status} />
                      <span className="text-xs text-ink-soft">
                        {a.category} ·{" "}
                        {a.submittedAt
                          ? `submitted ${timeAgo(a.submittedAt)}`
                          : `edited ${timeAgo(a.updatedAt)}`}
                      </span>
                    </div>
                    <p className="mt-1.5 font-serif text-lg font-bold">
                      {a.title || "Untitled draft"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <span>{a.author.name}</span>
                      <TierBadge tier={a.author.tier} />
                      <span>
                        {a.media.length} attachment{a.media.length === 1 ? "" : "s"}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-medium ${
                          a.translations.some(
                            (t) => t.locale !== a.language,
                          )
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        {a.translations.some((t) => t.locale !== a.language)
                          ? "both languages"
                          : `${a.language === "EN" ? "Bangla" : "English"} version missing`}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {a.status === "APPROVED" ? (
                      <span className="font-serif text-lg font-bold tabular-nums text-brand-dark">
                        {money(a.payoutCents, settings.currency)}
                      </span>
                    ) : null}
                    <Link
                      href={`/editorial/${a.id}`}
                      className="rounded-full bg-navy px-4 py-2 text-xs font-medium text-white hover:bg-navy-dark"
                    >
                      {a.status === "SUBMITTED" ? "Review" : "Open"}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
