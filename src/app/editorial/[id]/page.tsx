import Link from "next/link";
import { WriterContact } from "./writer-contact";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isAdmin, isStaff } from "@/lib/rbac";
import { timeAgo } from "@/lib/format";
import { paymentSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { StatusPill, TierBadge } from "@/components/ui";
import { ReviewPanel } from "./review-panel";
import { TranslationPanel } from "./translation-panel";
import { MediaDesk } from "./media-desk";
import { CoverPanel } from "./cover-panel";
import { CropEditor } from "./crop-editor";
import { DeleteArticle } from "./delete-article";

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
        author: {
          select: { id: true, name: true, email: true, tier: true, phone: true, whatsapp: true },
        },
        media: { orderBy: { createdAt: "asc" } },
        translations: { include: { translator: { select: { id: true, name: true } } } },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { editor: { select: { name: true, role: true } } },
        },
      },
    }),
    paymentSettings(),
  ]);
  if (!article) notFound();

  const needed = article.language === "EN" ? "BN" : "EN";
  const translation = article.translations.find((t) => t.locale === needed) ?? null;

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

        {/* The desk often needs one question answered before a piece can run, so
            the writer's number sits next to the copy rather than two screens away. */}
        <WriterContact
          articleId={article.id}
          authorId={article.author.id}
          authorName={article.author.name}
          phone={article.contactPhone ?? article.author.phone}
          whatsapp={article.contactWhatsapp ?? article.author.whatsapp}
          witnesses={article.witnesses}
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={article.status} />
          <span className="text-xs text-ink-soft">
            {article.author.name} ({article.author.email})
          </span>
          <TierBadge tier={article.author.tier} />
          <span className="text-xs text-ink-soft">
            {article.submittedAt ? `submitted ${timeAgo(article.submittedAt)}` : "not submitted"}
          </span>
          <span className="rounded-full border border-line bg-paper-soft px-2 py-0.5 text-xs font-medium text-ink-soft">
            written in {article.language === "BN" ? "Bangla" : "English"}
          </span>
          {/* A missing version is something to go and fix, so the badge takes
              you to the box where you write it. */}
          <a
            href="#translation"
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              translation
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            {translation
              ? `${needed === "BN" ? "Bangla" : "English"} version ready`
              : `${needed === "BN" ? "Bangla" : "English"} version missing - write it`}
          </a>
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
              language: article.language,
              coverImage: article.coverImage,
              homeSlot: article.homeSlot,
              bylineName: article.bylineName ?? "",
              authorName: article.author.name,
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


          <div className="grid gap-6">
            <CoverPanel
              articleId={article.id}
              initialCover={article.coverImage}
              published={article.status === "APPROVED"}
            />

            {article.coverImage ? (
              <CropEditor
                articleId={article.id}
                src={article.coverImage}
                home={article.coverCropHome}
                article={article.coverCropArticle}
              />
            ) : null}

            {/* Removing a piece is an admin's call, not an editor's. */}
            {isAdmin(user.role) ? (
              <DeleteArticle articleId={article.id} title={article.title} />
            ) : null}

            <aside className="rounded-xl border border-line p-4">
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

          <div className="lg:col-span-2">
            <MediaDesk
              articleId={article.id}
              cover={article.coverImage}
              initial={article.media.map((m) => ({
                id: m.id,
                kind: m.kind,
                url: m.url,
                caption: m.caption,
                originalName: m.originalName,
                isEvidence: m.isEvidence,
              }))}
            />
          </div>

          <div className="lg:col-span-2">
            <TranslationPanel
              articleId={article.id}
              sourceLocale={article.language}
              source={{
                title: article.title,
                dek: article.dek ?? "",
                body: article.body,
              }}
              existing={
                translation
                  ? {
                      title: translation.title,
                      dek: translation.dek ?? "",
                      body: translation.body,
                      translator: translation.translator?.name ?? null,
                      byAuthor: translation.translatorId === article.authorId,
                    }
                  : null
              }
            />
          </div>
        </div>
      </main>
    </>
  );
}
