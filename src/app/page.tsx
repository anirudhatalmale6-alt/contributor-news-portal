import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/site-header";
import { ArticleCard } from "@/components/ui";
import { SiteFooter } from "@/components/site-footer";

// The public feed is a static shell revalidated every 60s: a visitor is served
// cached HTML, not a database round-trip.
export const revalidate = 60;

const CATEGORIES = ["All", "Politics", "Technology", "Culture", "Business", "General"];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "All" } = await searchParams;

  const articles = await prisma.article.findMany({
    where: {
      status: "APPROVED",
      ...(category !== "All" ? { category } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 13,
    select: {
      slug: true,
      title: true,
      dek: true,
      body: true,
      category: true,
      coverImage: true,
      publishedAt: true,
      author: { select: { name: true, tier: true } },
    },
  });

  const [lead, ...rest] = articles;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap items-center gap-2 border-b border-line py-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={c === "All" ? "/" : `/?category=${c}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                c === category
                  ? "border-ink bg-ink text-white"
                  : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <p className="py-16 text-center text-ink-soft">
            Nothing published in this section yet.
          </p>
        ) : (
          <div className="pt-6">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>{lead ? <ArticleCard article={lead} lead /> : null}</div>

              <aside className="lg:border-l lg:border-line lg:pl-8">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  Also today
                </h2>
                <div className="grid gap-4">
                  {rest.slice(0, 3).map((a) => (
                    <Link
                      key={a.slug}
                      href={`/article/${a.slug}`}
                      className="group flex gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0"
                    >
                      {a.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.coverImage}
                          alt=""
                          loading="lazy"
                          className="size-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wide text-brand">
                          {a.category}
                        </span>
                        <span className="mt-0.5 block font-serif text-sm font-bold leading-snug group-hover:underline">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft">
                          {a.author.name}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </aside>
            </div>

            {rest.length > 3 ? (
              <section className="mt-10">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  More from our contributors
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.slice(3).map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <section className="mt-14 rounded-2xl border border-line bg-paper-soft p-6 sm:p-8">
          <h2 className="font-serif text-xl font-bold sm:text-2xl">Write for The Dispatch</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Open an account, draft your piece with photos or video, and submit it. An editor reads
            every submission before it is published - and sets the payout you earn for it.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Become a contributor
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
