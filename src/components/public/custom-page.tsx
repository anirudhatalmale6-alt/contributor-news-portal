import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SHELL } from "@/components/ui";
import { renderBody } from "@/components/rich-text";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { localeMeta, type Locale } from "@/lib/i18n";
import { localised, pagePath, publishedPage } from "@/lib/pages";

/** One of the owner's own pages, in one language. */
export async function CustomPage({ locale, slug }: { locale: Locale; slug: string }) {
  const page = await publishedPage(slug);
  if (!page) notFound();
  const site = await siteSettings();
  const { title, body, lang } = localised(page, locale);

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader locale={locale} switchHref={pagePath(locale === "BN" ? "EN" : "BN", slug)} />
      <main className={`${SHELL} pb-16`}>
        <article data-page={slug} lang={localeMeta[lang].htmlLang} className="mx-auto max-w-[46rem] py-10">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl">{title}</h1>
          <div className="prose-article mt-6">{renderBody(body)}</div>
        </article>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}

export async function customPageMeta(locale: Locale, slug: string) {
  const page = await publishedPage(slug);
  if (!page) return { title: locale === "BN" ? "পাতা পাওয়া যায়নি" : "Page not found" };
  return {
    title: localised(page, locale).title,
    alternates: {
      canonical: pagePath(locale, slug),
      languages: { bn: pagePath("BN", slug), en: pagePath("EN", slug) },
    },
  };
}
