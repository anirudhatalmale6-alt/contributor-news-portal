import Link from "next/link";
import { feedArticles } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCard } from "@/components/ui";
import { type Locale, localeMeta, localePath, t } from "@/lib/i18n";

const CATEGORIES = ["All", "Politics", "Technology", "Culture", "Business", "General"];

/** The public front page, in one language. */
export async function Feed({ locale, category }: { locale: Locale; category: string }) {
  const copy = t(locale);
  const articles = await feedArticles(locale, category);
  const [lead, ...rest] = articles;
  const base = localePath(locale);

  return (
    <div lang={localeMeta[locale].htmlLang}>
      <SiteHeader locale={locale} />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-wrap items-center gap-2 border-b border-line py-4">
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={c === "All" ? base : `${base}?category=${c}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                c === category
                  ? "border-navy bg-navy text-white"
                  : "border-line text-ink-soft hover:text-ink"
              }`}
            >
              {copy.sections[c] ?? c}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <div className="pt-6">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>{lead ? <ArticleCard article={lead} locale={locale} lead /> : null}</div>

              <aside className="lg:border-l lg:border-line lg:pl-8">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {copy.alsoToday}
                </h2>
                <div className="grid gap-4">
                  {rest.slice(0, 3).map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
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
                          {copy.sections[a.category] ?? a.category}
                        </span>
                        <span className="mt-0.5 block font-serif text-sm font-bold leading-snug group-hover:underline">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{a.author.name}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </aside>
            </div>

            {rest.length > 3 ? (
              <section className="mt-10">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {copy.moreFromContributors}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.slice(3).map((a) => (
                    <ArticleCard key={a.href} article={a} locale={locale} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <section className="mt-14 rounded-2xl border border-line bg-paper-soft p-6 sm:p-8">
          <h2 className="font-serif text-xl font-bold sm:text-2xl">{copy.ctaTitle}</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">{copy.ctaBody}</p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {copy.ctaButton}
          </Link>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
