import Link from "next/link";
import { notFound } from "next/navigation";
import { articleForLocale, relatedArticles } from "@/lib/articles";
import { AdSlot } from "@/components/ad-slot";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { SHELL, TierBadge } from "@/components/ui";
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

/**
 * Paragraphs, H2/H3, pull quotes and bullets - the same subset in both
 * languages.
 *
 * Read line by line rather than block by block. A contributor who writes a
 * heading and starts the next line underneath it, without a blank line between,
 * means a heading followed by a paragraph - not one very long heading.
 */
/**
 * Inline emphasis: **bold** and *italic*.
 *
 * Built into React elements rather than injected as HTML, so a contributor
 * cannot smuggle markup into a published page by typing it.
 */
function inline(text: string, keyBase: string) {
  const out: (string | React.ReactElement)[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    } else {
      out.push(<em key={`${keyBase}-i${i++}`}>{m[2]}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : text;
}

function renderBody(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactElement[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  let quote: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      const k = key++;
      out.push(<p key={k}>{inline(para.join(" "), `p${k}`)}</p>);
    }
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++}>
          {bullets.map((li, i) => (
            <li key={i}>{inline(li, `li${i}`)}</li>
          ))}
        </ul>,
      );
    }
    bullets = [];
  };
  const flushQuote = () => {
    if (quote.length) {
      const k = key++;
      out.push(<blockquote key={k}>{inline(quote.join(" "), `q${k}`)}</blockquote>);
    }
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushBullets();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushAll();
      continue;
    }
    if (line.startsWith("### ")) {
      flushAll();
      out.push(<h3 key={key++}>{inline(line.slice(4), `h3${key}`)}</h3>);
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      out.push(<h2 key={key++}>{inline(line.slice(3), `h2${key}`)}</h2>);
      continue;
    }
    if (/^[-*] /.test(line)) {
      flushPara();
      flushQuote();
      bullets.push(line.replace(/^[-*] /, ""));
      continue;
    }
    if (line.startsWith(">")) {
      flushPara();
      flushBullets();
      quote.push(line.replace(/^> ?/, ""));
      continue;
    }
    flushBullets();
    flushQuote();
    para.push(line);
  }
  flushAll();
  return out;
}

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
  // The right panel wants more than the four that used to sit at the foot.
  const related = await relatedArticles(locale, article.id, article.category, 8);

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
          {article.dek ? (
            <p className="mt-3 font-serif text-[19px] leading-snug text-ink-soft sm:text-xl">
              {article.dek}
            </p>
          ) : null}

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImage}
                alt=""
                className="w-full rounded-xl bg-paper-soft object-cover"
              />
            </figure>
          ) : null}

          <div className="prose-article mt-6">{renderBody(article.body)}</div>

          <AdSlot slot="banner" />

          {evidence.length > 0 ? (
            <section className="mt-10 rounded-xl border border-line bg-paper-soft p-4 sm:p-5">
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

          <AdSlot slot="article" />

        </article>
        </div>

        {/* Other news, as rectangular blocks down the right. It sticks as you
            read, so there is always somewhere to go next. */}
        <aside className="lg:sticky lg:top-14 lg:self-start lg:border-l lg:border-line lg:pl-8">
          <AdSlot slot="square" className="mt-6" />

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
                            src={r.coverImage}
                            alt=""
                            loading="lazy"
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
      <SiteFooter locale={locale} />
    </div>
  );
}
