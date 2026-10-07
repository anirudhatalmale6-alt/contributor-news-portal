import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { money, timeAgo } from "@/lib/format";
import { paymentSettings } from "@/lib/settings";
import { earningsTotal } from "@/lib/earnings";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { StatCard, StatusPill, TierBadge } from "@/components/ui";
import { FeatureToggle } from "./feature-toggle";

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
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/dashboard");

  const { status = "SUBMITTED", q = "" } = await searchParams;
  const term = q.trim();
  const where = {
    ...(status === "ALL"
      ? {}
      : { status: status as "SUBMITTED" | "APPROVED" | "REJECTED" | "DRAFT" }),
    ...(term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" as const } },
            { author: { name: { contains: term, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  // A review queue wants the oldest first so nothing waits behind newer work.
  // A list of published work wants the opposite: the newest piece is the one
  // most likely to need a correction.
  const orderBy =
    status === "APPROVED"
      ? [{ publishedAt: "desc" as const }, { updatedAt: "desc" as const }]
      : status === "SUBMITTED"
        ? [{ submittedAt: "asc" as const }, { updatedAt: "desc" as const }]
        : [{ updatedAt: "desc" as const }];

  const [articles, settings, counts] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy,
      include: {
        author: { select: { id: true, name: true, tier: true, role: true } },
        media: { select: { id: true, kind: true } },
        translations: { select: { locale: true } },
      },
    }),
    paymentSettings(),
    prisma.article.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const owed = await earningsTotal();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="pt-4">
          <StaffNav user={user} current={status === "APPROVED" ? "published" : "newsroom"} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line py-6">
          <div>
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">
              {status === "APPROVED" ? "Published articles" : "Editorial queue"}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {status === "APPROVED"
                ? "Newest first. Open any piece to edit it and publish the correction."
                : status === "SUBMITTED"
                  ? "Oldest submissions first, so nothing waits behind newer work."
                  : "Most recently changed first."}
            </p>
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
            label="Owed to contributors"
            value={money(owed.totalCents, settings.currency)}
            hint={
              owed.adjustmentCents
                ? `Including ${money(owed.adjustmentCents, settings.currency)} in corrections`
                : "Across all published work"
            }
          />
        </section>

        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/editorial?status=${t.key}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
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

          {/* A search that survives a page reload, because the newsroom will
              come back to the same piece more than once. */}
          <form method="GET" className="ml-auto flex items-center gap-2">
            <input type="hidden" name="status" value={status} />
            <input
              name="q"
              defaultValue={term}
              placeholder="Search headline or writer"
              className="w-56 rounded-full border border-line px-3.5 py-1.5 text-xs outline-none focus:border-navy"
            />
            <button
              type="submit"
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-soft"
            >
              Search
            </button>
            {term ? (
              <Link
                href={`/editorial?status=${status}`}
                className="text-xs text-ink-soft hover:text-ink"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        {articles.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">
            {term ? `Nothing matches "${term}" in this view.` : "Nothing in this view."}
          </p>
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
                        {a.status === "APPROVED" && a.publishedAt
                          ? `published ${timeAgo(a.publishedAt)}`
                          : a.submittedAt
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
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <FeatureToggle
                      articleId={a.id}
                      initial={a.featured}
                      disabled={a.status !== "APPROVED"}
                    />
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
