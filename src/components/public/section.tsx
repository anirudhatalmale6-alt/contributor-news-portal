import { feedArticles } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/ui";
import { type Locale, localeMeta, sectionPath, t } from "@/lib/i18n";

/** One section of the paper, in one language. */
export async function SectionPage({ locale, category }: { locale: Locale; category: string }) {
  const copy = t(locale);
  const site = await siteSettings();
  const articles = await feedArticles(locale, category, 24);
  const [lead, ...rest] = articles;
  const name = copy.sections[category] ?? category;

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
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <h1 className="mt-8 font-serif text-3xl font-bold sm:text-4xl">{name}</h1>

        {!lead ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <>
            <div className="mt-6">
              <ArticleCard article={lead} locale={locale} lead />
            </div>

            <AdSlot slot="section" />

            {rest.length > 0 ? (
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <ArticleCard key={a.href} article={a} locale={locale} />
                ))}
              </div>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
