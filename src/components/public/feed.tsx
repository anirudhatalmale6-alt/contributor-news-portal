import Link from "next/link";
import { featuredArticles, feedArticles, type LocalisedArticle } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard, SHELL } from "@/components/ui";
import { type Locale, localeMeta, t } from "@/lib/i18n";

/** A headline with a thumbnail, the unit both side rails are built from. */
function RailItem({
  article,
  locale,
  thumb = true,
}: {
  article: LocalisedArticle;
  locale: Locale;
  thumb?: boolean;
}) {
  const copy = t(locale);
  return (
    <Link href={article.href} className="group block border-t border-line pt-3 first:border-t-0 first:pt-0">
      <span className="flex gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">
            {copy.sections[article.category] ?? article.category}
          </span>
          <span className="mt-0.5 block font-serif text-[15px] font-bold leading-snug group-hover:underline">
            {article.title}
          </span>
          <span className="mt-1 block text-xs text-ink-soft">{article.author.name}</span>
        </span>
        {thumb && article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.coverImage}
            alt=""
            loading="lazy"
            className="size-16 shrink-0 rounded object-cover"
          />
        ) : null}
      </span>
    </Link>
  );
}

/**
 * The front page.
 *
 * Three columns, the way the papers he pointed at are laid out: a narrow rail
 * of secondary stories on the left, the lead in the middle, and a rail of
 * further reading plus the advertising slot on the right. Everything starts on
 * the same left edge as the masthead.
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
    feedArticles(locale, category, 22),
  ]);

  const featuredHrefs = new Set(featured.map((a) => a.href));
  const rest = latest.filter((a) => !featuredHrefs.has(a.href));

  const pool = [...featured.slice(1), ...rest];
  const lead = featured[0] ?? pool.shift() ?? null;
  const leftRail = pool.splice(0, 3);
  const underLead = pool.splice(0, 2);
  const rightRail = pool.splice(0, 4);
  const more = pool;

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader
        locale={locale}
        activeCategory={category === "All" ? undefined : category}
        teasers
        teaserExclude={[lead?.href, ...leftRail.map((a) => a.href), ...underLead.map((a) => a.href)].filter(
          (h): h is string => Boolean(h),
        )}
      />
      <main className={`${SHELL} pb-16`}>
        {!lead ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <div className="pt-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)_minmax(0,300px)] lg:gap-7">
              {/* Left rail: what else is running today. */}
              <aside className="order-2 grid content-start gap-3 lg:order-1">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                  {copy.alsoToday}
                </h2>
                {leftRail.map((a) => (
                  <RailItem key={a.href} article={a} locale={locale} />
                ))}
              </aside>

              {/* The lead, and the two pieces that sit directly under it. */}
              <div className="order-1 lg:order-2 lg:border-x lg:border-line lg:px-7">
                <ArticleCard article={lead} locale={locale} lead />
                {underLead.length > 0 ? (
                  <div className="mt-6 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
                    {underLead.map((a) => (
                      <ArticleCard key={a.href} article={a} locale={locale} compact />
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Right rail: further reading, then the advertising slot. */}
              <aside className="order-3 grid content-start gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
                  {featured.length > 1 ? copy.featured : copy.moreFromContributors}
                </h2>
                {rightRail.map((a) => (
                  <RailItem key={a.href} article={a} locale={locale} />
                ))}
                <AdSlot slot="home" />
              </aside>
            </div>

            {more.length > 0 ? (
              <section className="mt-10 border-t-2 border-ink pt-5">
                <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {copy.moreFromContributors}
                </h2>
                <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
                  {more.map((a) => (
                    <ArticleCard key={a.href} article={a} locale={locale} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <section className="mt-14 border-t-2 border-ink pt-6">
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
