import { feedArticles, sectionLeadArticle } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard, RailItem, SHELL } from "@/components/ui";
import { type Locale, localeMeta, sectionPath, t } from "@/lib/i18n";

/**
 * One section of the paper, in one language.
 *
 * Laid out like the front page rather than like a list: the lead takes two
 * thirds of the width with the next few headlines in a rail beside it, and
 * everything after that falls into a grid underneath. The lead used to run the
 * full width of the page, which on a laptop meant a photograph tall enough to
 * fill the screen with the headline somewhere below the fold, and a third of
 * the page left empty beside the stories under it.
 *
 * Which piece leads is the desk's choice - they tick "Lead of its section" on
 * the review screen. With nothing ticked the newest piece in the section
 * leads, so a section nobody has arranged still reads properly.
 */
export async function SectionPage({ locale, category }: { locale: Locale; category: string }) {
  const copy = t(locale);
  const site = await siteSettings();
  const name = copy.sections[category] ?? category;

  // Enough to fill the lead, the rail and the grid, plus a few spare in case
  // the pinned lead is further down the list than the pool reaches.
  const need = 1 + site.maxSectionRail + site.maxSectionGrid + 6;
  const [chosen, latest] = await Promise.all([
    sectionLeadArticle(locale, category),
    feedArticles(locale, category, need),
  ]);

  const lead = chosen ?? latest[0] ?? null;
  const rest = latest.filter((a) => a.href !== lead?.href);
  const rail = rest.slice(0, site.maxSectionRail);
  const grid = rest.slice(site.maxSectionRail, site.maxSectionRail + site.maxSectionGrid);

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader
        locale={locale}
        activeCategory={category}
        switchHref={sectionPath(locale === "BN" ? "EN" : "BN", category)}
      />
      <main className={`${SHELL} pb-16`}>
        <div className="mt-7 flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-2">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">{name}</h1>
          <p className="pb-1 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            {copy.latest}
          </p>
        </div>

        <AdSlot slot="section" locale={locale} className="mt-4" />

        {!lead ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <>
            <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div className="min-w-0">
                <ArticleCard article={lead} locale={locale} lead headlineFirst />
              </div>

              {rail.length > 0 ? (
                <aside className="order-last grid content-start gap-3 border-t border-line pt-5 lg:order-none lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                  <h2 className="border-b-2 border-ink pb-1.5 text-xs font-bold uppercase tracking-widest">
                    {copy.alsoToday}
                  </h2>
                  {rail.map((a) => (
                    <RailItem key={a.href} article={a} locale={locale} />
                  ))}
                  <AdSlot slot="square" locale={locale} />
                </aside>
              ) : null}
            </div>

            {grid.length > 0 ? (
              <section className="mt-10 border-t-2 border-ink pt-5">
                <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {copy.moreInSection(name)}
                </h2>
                <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {grid.map((a) => (
                    <ArticleCard key={a.href} article={a} locale={locale} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
