import Link from "next/link";
import { featuredArticles, feedArticles, type LocalisedArticle } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/ui";
import { type Locale, localeMeta, t } from "@/lib/i18n";

/**
 * The front page.
 *
 * An editor decides what leads by featuring it. Only if nothing is featured
 * does the page fall back to the newest piece, so a fresh install still looks
 * like a newspaper rather than an empty shelf.
 */
export async function Feed({ locale, category }: { locale: Locale; category: string }) {
  const copy = t(locale);
  const site = await siteSettings();
  const [featured, latest] = await Promise.all([
    category === "All" ? featuredArticles(locale, 5) : Promise.resolve([] as LocalisedArticle[]),
    feedArticles(locale, category, 16),
  ]);

  const featuredHrefs = new Set(featured.map((a) => a.href));
  const rest = latest.filter((a) => !featuredHrefs.has(a.href));

  const lead = featured[0] ?? rest.shift() ?? null;
  const secondary = featured.slice(1, 4);
  const rail = secondary.length ? secondary : rest.splice(0, 3);

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader locale={locale} activeCategory={category === "All" ? undefined : category} />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        {!lead ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <div className="pt-8">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <ArticleCard article={lead} locale={locale} lead />
              </div>

              <aside className="lg:border-l lg:border-line lg:pl-8">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {featured.length > 1 ? copy.featured : copy.alsoToday}
                </h2>
                <div className="grid gap-4">
                  {rail.map((a) => (
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

            <AdSlot slot="home" />

            {rest.length > 0 ? (
              <section className="mt-10">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {copy.moreFromContributors}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((a) => (
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
