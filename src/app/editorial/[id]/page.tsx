import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { timeAgo } from "@/lib/format";
import { paymentSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatusPill, TierBadge } from "@/components/ui";
import { ReviewPanel } from "./review-panel";

export const metadata = { title: "Review" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/dashboard");

  const { id } = await params;
  const [article, settings] = await Promise.all([
    prisma.article.findUnique({
      where: { id },
      include: {
        author: { select: { name: true, email: true, tier: true } },
        media: { orderBy: { createdAt: "asc" } },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { editor: { select: { name: true, role: true } } },
        },
      },
    }),
    paymentSettings(),
  ]);
  if (!article) notFound();

  // A Verified Contributor's suggested figure carries the admin's bonus.
  const suggested =
    article.payoutCents ||
    Math.round(
      settings.defaultPayout *
        (article.author.tier === "VERIFIED" ? 1 + settings.verifiedBonusPct / 100 : 1),
    );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <Link href="/editorial" className="inline-block py-4 text-sm text-ink-soft hover:text-ink">
          &larr; Back to the queue
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={article.status} />
          <span className="text-xs text-ink-soft">
            {article.author.name} ({article.author.email})
          </span>
          <TierBadge tier={article.author.tier} />
          <span className="text-xs text-ink-soft">
            {article.submittedAt ? `submitted ${timeAgo(article.submittedAt)}` : "not submitted"}
          </span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <ReviewPanel
            article={{
              id: article.id,
              title: article.title,
              dek: article.dek ?? "",
              body: article.body,
              category: article.category,
              status: article.status,
              slug: article.slug,
              payoutCents: article.payoutCents,
              media: article.media.map((m) => ({
                id: m.id,
                kind: m.kind,
                url: m.url,
                caption: m.caption,
              })),
            }}
            settings={{
              currency: settings.currency,
              suggestedCents: suggested,
              verifiedBonusPct: settings.verifiedBonusPct,
            }}
            authorTier={article.author.tier}
          />

          <aside className="rounded-xl border border-line p-4 lg:sticky lg:top-24">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
              Activity
            </h2>
            <ol className="mt-3 grid gap-3">
              {article.reviews.length === 0 ? (
                <li className="text-sm text-ink-soft">No activity yet.</li>
              ) : null}
              {article.reviews.map((r) => (
                <li key={r.id} className="border-l-2 border-line pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    {r.action.replace("_", " ").toLowerCase()}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {r.editor ? `${r.editor.name} · ` : ""}
                    {timeAgo(r.createdAt)}
                  </p>
                  {r.note ? <p className="mt-1 text-sm">{r.note}</p> : null}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </main>
    </>
  );
}
