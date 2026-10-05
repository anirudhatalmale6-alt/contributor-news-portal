import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TierBadge } from "@/components/ui";
import { longDate, readingTime } from "@/lib/format";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

async function getArticle(slug: string) {
  return prisma.article.findFirst({
    where: { slug, status: "APPROVED" },
    include: {
      author: { select: { name: true, tier: true, bio: true } },
      media: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.dek ?? undefined,
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      images: article.coverImage ? [article.coverImage] : undefined,
      type: "article",
    },
  };
}

// Pre-render the published set at build time; anything newer is generated on
// first request and then cached.
export async function generateStaticParams() {
  const rows = await prisma.article.findMany({
    where: { status: "APPROVED" },
    select: { slug: true },
    take: 200,
  });
  return rows.map((r) => ({ slug: r.slug }));
}

/** Minimal, safe rendering of the stored copy: paragraphs, H2/H3, quotes, lists. */
function renderBody(body: string) {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks.map((raw, i) => {
    const block = raw.trim();
    if (!block) return null;
    if (block.startsWith("### ")) return <h3 key={i}>{block.slice(4)}</h3>;
    if (block.startsWith("## ")) return <h2 key={i}>{block.slice(3)}</h2>;
    if (block.startsWith("> ")) {
      return <blockquote key={i}>{block.replace(/^> ?/gm, "")}</blockquote>;
    }
    if (/^[-*] /.test(block)) {
      return (
        <ul key={i}>
          {block.split("\n").map((li, j) => (
            <li key={j}>{li.replace(/^[-*] /, "")}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{block}</p>;
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const gallery = article.media.filter((m) => m.url !== article.coverImage);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-16">
        <nav className="py-4 text-xs text-ink-soft">
          <Link href="/" className="hover:text-ink">
            Latest
          </Link>
          <span className="px-1.5" aria-hidden>
            /
          </span>
          <Link href={`/?category=${article.category}`} className="hover:text-ink">
            {article.category}
          </Link>
        </nav>

        <article>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {article.category}
          </p>
          <h1 className="balance mt-2 font-serif text-3xl font-bold leading-tight sm:text-4xl">
            {article.title}
          </h1>
          {article.dek ? (
            <p className="mt-3 font-serif text-lg text-ink-soft sm:text-xl">{article.dek}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3 text-sm">
            <span className="font-medium">{article.author.name}</span>
            <TierBadge tier={article.author.tier} />
            <span className="text-ink-soft">
              {article.publishedAt ? longDate(article.publishedAt) : ""} ·{" "}
              {readingTime(article.body)} min read
            </span>
          </div>

          {article.coverImage ? (
            <figure className="mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImage}
                alt=""
                className="w-full rounded-xl bg-paper-soft object-cover"
              />
            </figure>
          ) : null}

          <div className="prose-article mt-6">{renderBody(article.body)}</div>

          {gallery.length > 0 ? (
            <section className="mt-10 border-t border-line pt-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
                More media
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {gallery.map((m) => (
                  <figure key={m.id}>
                    {m.kind === "VIDEO" ? (
                      <video
                        src={m.url}
                        controls
                        preload="none"
                        className="w-full rounded-lg bg-black"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.url}
                        alt={m.caption ?? ""}
                        loading="lazy"
                        className="w-full rounded-lg object-cover"
                      />
                    )}
                    {m.caption ? (
                      <figcaption className="mt-1 text-xs text-ink-soft">{m.caption}</figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <aside className="mt-10 rounded-xl border border-line bg-paper-soft p-5">
            <p className="text-sm font-medium">About {article.author.name}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {article.author.bio ?? "Contributor at The Dispatch."}
            </p>
          </aside>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
