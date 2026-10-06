import Link from "next/link";
import { notFound } from "next/navigation";
import { articleForLocale, relatedArticles } from "@/lib/articles";
import { AdSlot } from "@/components/ad-slot";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { TierBadge } from "@/components/ui";
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

/** Paragraphs, H2/H3, pull quotes and bullets - the same subset in both languages. */
function renderBody(body: string) {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((raw, i) => {
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

export async function ArticleView({ locale, slug }: { locale: Locale; slug: string }) {
  const article = await articleForLocale(locale, slug);
  if (!article) notFound();

  const site = await siteSettings();
  const copy = t(locale);
  const alt = other(locale);
  // Readers see only what an editor put in the Evidence gallery.
  const evidence = article.media
    .filter((m) => m.isEvidence)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const related = await relatedArticles(locale, article.id, article.category, 4);

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader
        locale={locale}
        switchHref={article.counterpartHref ?? localePath(alt)}
      />
      <main className="mx-auto max-w-2xl px-4 pb-16">
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
          <h1 className="balance mt-2 font-serif text-3xl font-bold leading-tight sm:text-4xl">
            {article.title}
          </h1>
          {article.dek ? (
            <p className="mt-3 font-serif text-lg text-ink-soft sm:text-xl">{article.dek}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3 text-sm">
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
                className="ml-auto rounded-full border border-line px-3 py-1 text-xs font-medium text-navy hover:bg-paper-soft"
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

          {related.length > 0 ? (
            <section className="mt-10 border-t border-line pt-6">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
                {copy.relatedTitle}
              </h2>
              <ul className="grid gap-5 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="group flex gap-3">
                      {r.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.coverImage}
                          alt=""
                          loading="lazy"
                          className="size-20 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-wide text-brand">
                          {copy.sections[r.category] ?? r.category}
                        </span>
                        <span className="mt-0.5 block font-serif text-sm font-bold leading-snug group-hover:underline">
                          {r.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{r.author.name}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
