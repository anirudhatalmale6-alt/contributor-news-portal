import { renderBody } from "@/components/rich-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleForLocale, relatedArticles } from "@/lib/articles";
import { AdSlot } from "@/components/ad-slot";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { SHELL, TierBadge } from "@/components/ui";
import { CoverImage } from "@/components/cover-image";
import { readingTime } from "@/lib/format";
import {
  type Locale,
  localeDate,
  localeNumber,
  localePath,
  other,
  localeMeta,
  sectionPath,
  t,
} from "@/lib/i18n";


export async function ArticleView({ locale, slug }: { locale: Locale; slug: string }) {
  const article = await articleForLocale(locale, slug);
  if (!article) notFound();

  const site = await siteSettings();
  const copy = t(locale);
  const alt = other(locale);
  // Readers see only what an editor put in the Evidence gallery, and never the
  // cover photo - it is already at the top of the page, and showing it again as
  // "evidence" is just the same picture twice. With nothing else attached the
  // whole section disappears rather than standing there empty.
  const evidence = article.media
    .filter((m) => m.isEvidence && m.url !== article.coverImage)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  // How many pieces the right-hand panel carries is the owner's decision.
  // The side panel takes the first few; the row under the article (like the
  // Guardian's "More on this story") takes the next four, so the two never
  // repeat each other.
  const pool = await relatedArticles(locale, article.id, article.category, site.maxRelated + 4);
  const related = pool.slice(0, site.maxRelated);
  const moreOnThis = pool.slice(site.maxRelated, site.maxRelated + 4);

  // The owner's notice for the end of every article, in this side's language
  // or, if he only wrote one, the other.
  const notice = site.articleNoticeOn
    ? {
        body: (locale === "BN" ? site.articleNoticeBn : site.articleNoticeEn).trim() ||
          (locale === "BN" ? site.articleNoticeEn : site.articleNoticeBn).trim(),
        button: (locale === "BN" ? site.articleNoticeButtonBn : site.articleNoticeButtonEn).trim() ||
          (locale === "BN" ? site.articleNoticeButtonEn : site.articleNoticeButtonBn).trim(),
        url: site.articleNoticeUrl.trim(),
      }
    : null;

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader
        locale={locale}
        switchHref={article.counterpartHref ?? localePath(alt)}
        activeCategory={article.category}
        teasers
        teaserNever={article.href}
        teaserExclude={related.map((r) => r.href)}
      />
      {/* The copy starts on the same left edge as the masthead, with the other
          news in a panel down the right. The reading column is still capped,
          because a headline can be wide but a paragraph cannot. */}
      <main className={`${SHELL} grid gap-8 pb-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10`}>
        <div className="min-w-0 max-w-[48rem]">
        <nav className="py-4 text-xs text-ink-soft">
          <Link href={localePath(locale)} className="hover:text-ink">
            {copy.latest}
          </Link>
          <span className="px-1.5" aria-hidden>
            /
          </span>
          <Link href={sectionPath(locale, article.category)} className="hover:text-ink">
            {copy.sections[article.category] ?? article.category}
          </Link>
        </nav>

        <article>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {copy.sections[article.category] ?? article.category}
          </p>
          <h1 className="balance mt-2 font-serif text-[28px] font-bold leading-tight sm:text-4xl">
            {article.title}
          </h1>
          {/* The standfirst is the one-line summary that sells the piece in a
              list. It is deliberately not repeated here: a reader who has
              clicked through has already read it, and seeing it again above
              the first paragraph reads as the article repeating itself. It is
              still used for the feed, for search results and for the preview
              a shared link shows. */}

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3 text-[15px] sm:text-sm">
            {article.author.id ? (
              <Link
                href={
                  locale === "BN"
                    ? `/author/${article.author.id}`
                    : `/en/author/${article.author.id}`
                }
                className="font-medium hover:underline"
              >
                {article.author.name}
              </Link>
            ) : (
              <span className="font-medium">{article.author.name}</span>
            )}
            <TierBadge
              tier={article.author.tier}
              label={copy.verified}
              generalLabel={copy.contributor}
            />
            <span className="text-ink-soft">
              {article.publishedAt ? localeDate(article.publishedAt, locale) : ""} ·{" "}
              {copy.minRead(localeNumber(readingTime(article.body), locale))}
            </span>
            {article.counterpartHref ? (
              <Link
                href={article.counterpartHref}
                hrefLang={localeMeta[alt].htmlLang}
                lang={localeMeta[alt].htmlLang}
                className="rounded-full border border-line px-3 py-1 text-xs font-medium text-navy hover:bg-paper-soft sm:ml-auto"
              >
                {copy.readInOther}
              </Link>
            ) : null}
          </div>

          {article.isTranslation ? (
            <p className="mt-3 text-xs text-ink-soft">
              {article.translatorName
                ? copy.translatedBy(article.translatorName)
                : copy.originalLanguageNote}
            </p>
          ) : null}

          {article.coverImage ? (
            <figure className="mt-6">
              <CoverImage
                src={article.coverImage}
                crop={article.coverCropArticle}
                shape="article"
                eager
                className="rounded-xl"
              />
            </figure>
          ) : null}

          <div className="prose-article mt-6">{renderBody(article.body)}</div>

          {/* No banner here. The banner belongs to the front page; an article
              has its own slot at the foot, which the desk sets separately. */}

          {evidence.length > 0 ? (
            <section
              id="evidence"
              className="mt-10 rounded-xl border border-line bg-paper-soft p-4 sm:p-5"
            >
              <h2 className="text-sm font-bold">{copy.evidenceTitle}</h2>
              <p className="mb-4 mt-1 text-xs text-ink-soft">{copy.evidenceNote}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {evidence.map((m) => (
                  <figure key={m.id}>
                    {m.kind === "VIDEO" ? (
                      <video src={m.url} controls preload="none" className="w-full rounded-lg bg-black" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${m.url}?w=800`}
                        srcSet={`${m.url}?w=480 480w, ${m.url}?w=800 800w, ${m.url}?w=1200 1200w`}
                        sizes="(min-width: 640px) 360px, 100vw"
                        alt={m.caption ?? ""}
                        loading="lazy"
                        decoding="async"
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

          {notice?.body ? (
            <aside
              data-article-notice
              className="mt-10 rounded-xl border-t-4 border-brand bg-amber-50/60 p-5 text-[15px] leading-relaxed ring-1 ring-line"
            >
              <div className="prose-article [&>h2]:mt-0 [&>h2]:text-xl">{renderBody(notice.body)}</div>
              {notice.button && notice.url ? (
                <Link
                  href={notice.url}
                  className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
                >
                  {notice.button}
                </Link>
              ) : null}
            </aside>
          ) : null}

          {/* A name the desk typed has no account behind it, so there is no
              profile to introduce and no bio to print. */}
          {article.author.id || article.author.bio ? (
          <aside className="mt-10 rounded-xl border border-line bg-paper-soft p-5">
            <p className="text-sm font-medium">
              {article.author.id ? (
                <Link
                  href={
                    locale === "BN"
                      ? `/author/${article.author.id}`
                      : `/en/author/${article.author.id}`
                  }
                  className="hover:underline"
                >
                  {copy.about(article.author.name)}
                </Link>
              ) : (
                copy.about(article.author.name)
              )}
            </p>
            <p className="mt-1 text-sm text-ink-soft">{article.author.bio ?? copy.defaultBio}</p>
          </aside>
          ) : null}

          {/* The article page's own advertising space, set in Settings under
              "Article page" - nothing else on the site writes to it. */}
          <AdSlot slot="article" locale={locale} />

        </article>
        </div>

        {/* Other news, as rectangular blocks down the right. It sticks as you
            read, so there is always somewhere to go next. */}
        <aside className="lg:sticky lg:top-14 lg:self-start lg:border-l lg:border-line lg:pl-8">
          <AdSlot slot="square" locale={locale} className="mt-6" />

          {related.length > 0 ? (
            <section className="pt-6">
              <h2 className="border-b-2 border-ink pb-2 text-xs font-bold uppercase tracking-widest">
                {copy.relatedTitle}
              </h2>
              <ul className="mt-4 grid gap-4">
                {related.map((r) => (
                  <li key={r.href} className="border border-line">
                    <Link href={r.href} className="group block">
                      {r.coverImage ? (
                        <span className="block aspect-16/9 overflow-hidden bg-paper-soft">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${r.coverImage}?w=480`}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="size-full object-cover"
                          />
                        </span>
                      ) : null}
                      <span className="block p-3">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand">
                          {copy.sections[r.category] ?? r.category}
                        </span>
                        <span className="mt-0.5 block font-serif text-[15px] font-bold leading-snug group-hover:underline">
                          {r.title}
                        </span>
                        <span className="mt-1 block text-xs text-ink-soft">{r.author.name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </main>

      {moreOnThis.length > 0 ? (
        <section data-more-on-this className={`${SHELL} border-t-2 border-ink pb-16 pt-6`}>
          <h2 className="mb-5 font-serif text-2xl font-bold">{copy.moreOnThisStory}</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {moreOnThis.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="group block">
                  {r.coverImage ? (
                    <span className="block aspect-16/9 overflow-hidden rounded-sm bg-paper-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${r.coverImage}?w=480`} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                    </span>
                  ) : null}
                  <span className="mt-2 block text-[12px] font-bold uppercase tracking-wide text-brand">
                    {copy.sections[r.category] ?? r.category}
                  </span>
                  <span className="mt-0.5 block font-serif text-lg font-bold leading-snug group-hover:underline">
                    {r.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-soft">{r.author.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <SiteFooter locale={locale} />
    </div>
  );
}
