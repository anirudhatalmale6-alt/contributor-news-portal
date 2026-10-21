import Link from "next/link";
import { feedArticles, sectionLeadArticle, type LocalisedArticle } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { CoverImage } from "@/components/cover-image";
import { SHELL } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { type Locale, localeMeta, sectionPath, t } from "@/lib/i18n";

/**
 * One section of the paper, in one language, laid out the way The Hindu lays
 * out its section pages (he pointed at thehindu.com/news/international):
 *
 *   - the section's name centred between double rules;
 *   - three columns across the top: a column of headlines on the left, the
 *     lead in the middle with its picture and summary side by side and three
 *     more stories under it, and the advertising space on the right;
 *   - a row of four stories with pictures;
 *   - "More stories from ..." as a list with small pictures, with the newest
 *     pieces from the whole paper running down the right.
 *
 * The point of it is density: a reader sees a dozen stories on the first two
 * screens instead of one big photograph. Each block disappears if there is
 * nothing to put in it, so a section with three pieces still looks finished.
 *
 * Which piece leads is the desk's choice ("Lead of its section page" on the
 * review screen); otherwise the newest leads. How many go in the left column
 * and in the list are the owner's numbers in Settings.
 */

const UNDER_LEAD = 3;
const CARD_ROW = 4;
const LATEST = 6;

function authorHref(a: LocalisedArticle, locale: Locale) {
  if (!a.author.id) return null;
  return locale === "BN" ? `/author/${a.author.id}` : `/en/author/${a.author.id}`;
}

/** The kicker above a headline: which section it belongs to. */
function Kicker({ article, locale }: { article: LocalisedArticle; locale: Locale }) {
  const copy = t(locale);
  return (
    <p className="text-[13px] font-bold uppercase tracking-wide text-brand sm:text-xs">
      {copy.sections[article.category] ?? article.category}
    </p>
  );
}

/** The byline under a headline, small and quiet, the way the papers set it. */
function Byline({ article, locale }: { article: LocalisedArticle; locale: Locale }) {
  const href = authorHref(article, locale);
  const cls = "text-[12px] font-semibold uppercase tracking-wide text-ink-soft sm:text-[11px]";
  return href ? (
    <Link href={href} className={`${cls} underline decoration-line underline-offset-4 hover:text-ink`}>
      {article.author.name}
    </Link>
  ) : (
    <span className={cls}>{article.author.name}</span>
  );
}

function Headline({
  article,
  size,
}: {
  article: LocalisedArticle;
  size: "lead" | "big" | "normal" | "small";
}) {
  const cls = {
    lead: "text-[28px] leading-[1.15] sm:text-[34px]",
    big: "text-[21px] leading-snug sm:text-[22px]",
    normal: "text-[19px] leading-snug sm:text-lg",
    small: "text-[18px] leading-snug sm:text-[17px]",
  }[size];
  return (
    <Link href={article.href} className="group block">
      <h2 className={`balance font-serif font-bold group-hover:underline ${cls}`}>{article.title}</h2>
    </Link>
  );
}

/** Headline only, for the column down the left. */
function TextItem({ article, locale }: { article: LocalisedArticle; locale: Locale }) {
  return (
    <article className="grid gap-1.5 border-b border-line pb-4 last:border-b-0">
      <Kicker article={article} locale={locale} />
      <Headline article={article} size="small" />
      <Byline article={article} locale={locale} />
    </article>
  );
}

/** Picture on top, then the words: the row of four, and one story under the lead. */
function CardItem({ article, locale }: { article: LocalisedArticle; locale: Locale }) {
  return (
    <article className="grid content-start gap-2">
      {article.coverImage ? (
        <Link href={article.href} aria-hidden tabIndex={-1}>
          <CoverImage
            src={article.coverImage}
            crop={article.coverCropHome}
            shape="home"
            className="rounded-sm"
            sizes="(min-width: 1024px) 300px, 50vw"
          />
        </Link>
      ) : null}
      <Kicker article={article} locale={locale} />
      <Headline article={article} size="normal" />
      <Byline article={article} locale={locale} />
    </article>
  );
}

/** A small square picture beside the headline: the "More stories" list. */
function ListItem({ article, locale }: { article: LocalisedArticle; locale: Locale }) {
  return (
    <article className="flex gap-4 border-b border-line py-4 first:pt-0">
      {article.coverImage ? (
        <Link href={article.href} aria-hidden tabIndex={-1} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${article.coverImage}?w=320`}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-24 rounded-sm object-cover sm:size-[120px]"
          />
        </Link>
      ) : null}
      <div className="grid min-w-0 content-start gap-1.5">
        <Kicker article={article} locale={locale} />
        <Headline article={article} size="big" />
        {article.dek ? <p className="line-clamp-2 text-sm text-ink-soft">{article.dek}</p> : null}
        <Byline article={article} locale={locale} />
      </div>
    </article>
  );
}

/** The section's name, centred between double rules. */
function SectionTitle({ name, locale }: { name: string; locale: Locale }) {
  const rule =
    "h-[7px] flex-1 bg-[repeating-linear-gradient(to_bottom,var(--color-line)_0,var(--color-line)_1px,transparent_1px,transparent_3px)]";
  return (
    <div className="mt-8 flex items-center gap-4" lang={localeMeta[locale].htmlLang}>
      <span aria-hidden className={rule} />
      <h1 className="shrink-0 font-serif text-3xl font-bold text-brand sm:text-4xl">{name}</h1>
      <span aria-hidden className={rule} />
    </div>
  );
}

/** The newest pieces from the whole paper, with how long ago each went up. */
function LatestNews({ items, locale }: { items: LocalisedArticle[]; locale: Locale }) {
  const copy = t(locale);
  if (items.length === 0) return null;
  return (
    <section data-block="latest" aria-labelledby="latest-news">
      <h2 id="latest-news" className="mb-4 font-serif text-2xl font-bold text-brand">
        {copy.latestNews}
      </h2>
      <ol className="relative grid gap-4 border-l border-ink/70 pl-5">
        {items.map((a) => (
          <li key={a.href} className="relative">
            <span aria-hidden className="absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-ink bg-paper" />
            <p className="text-[12px] text-ink-soft">
              {a.publishedAt ? timeAgo(a.publishedAt, locale) : null}
              {" · "}
              {copy.sections[a.category] ?? a.category}
            </p>
            <Link href={a.href} className="mt-0.5 block font-serif text-[17px] font-bold leading-snug hover:underline sm:text-base">
              {a.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export async function SectionPage({ locale, category }: { locale: Locale; category: string }) {
  const copy = t(locale);
  const site = await siteSettings();
  const name = copy.sections[category] ?? category;

  const leftCount = site.maxSectionRail;
  const listCount = site.maxSectionGrid;
  // Enough to fill every block, plus a few spare in case the chosen lead is
  // further down the list than the pool reaches.
  const need = 1 + UNDER_LEAD + leftCount + CARD_ROW + listCount + 6;
  const [chosen, inSection, everywhere] = await Promise.all([
    sectionLeadArticle(locale, category),
    feedArticles(locale, category, need),
    feedArticles(locale, "All", LATEST + 12),
  ]);

  const lead = chosen ?? inSection[0] ?? null;
  const pool = inSection.filter((a) => a.href !== lead?.href);
  const take = (n: number) => pool.splice(0, Math.max(0, n));
  // Most prominent first: under the lead, then the column, then the row,
  // then the list.
  const underLead = take(UNDER_LEAD);
  const left = take(leftCount);
  const cards = take(CARD_ROW);
  const list = take(listCount);
  // Latest from the whole paper, leaving out what this page already shows.
  const shown = new Set([lead, ...underLead, ...left, ...cards, ...list].map((a) => a?.href));
  const latest = everywhere.filter((a) => !shown.has(a.href)).slice(0, LATEST);

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
        <SectionTitle name={name} locale={locale} />

        <AdSlot slot="section" locale={locale} className="mt-5" />

        {!lead ? (
          <p className="py-16 text-center text-ink-soft">{copy.nothingHere}</p>
        ) : (
          <>
            {/* --- the top: column | lead | advertising -------------------- */}
            <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] lg:gap-6">
              <div data-block="left" className="order-2 grid content-start gap-4 lg:order-1">
                {left.map((a) => (
                  <TextItem key={a.href} article={a} locale={locale} />
                ))}
              </div>

              <div className="order-1 min-w-0 lg:order-2 lg:border-x lg:border-line lg:px-6">
                <article data-block="lead" className="grid gap-3">
                  <Kicker article={lead} locale={locale} />
                  <Headline article={lead} size="lead" />
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    {lead.coverImage ? (
                      <Link href={lead.href} aria-hidden tabIndex={-1}>
                        <CoverImage
                          src={lead.coverImage}
                          crop={lead.coverCropHome}
                          shape="home"
                          eager
                          className="rounded-sm"
                          sizes="(min-width: 1024px) 380px, 100vw"
                        />
                      </Link>
                    ) : null}
                    <div className={`grid content-start gap-2 ${lead.coverImage ? "" : "sm:col-span-2"}`}>
                      {lead.dek ? <p className="text-[17px] leading-relaxed text-ink">{lead.dek}</p> : null}
                      <Byline article={lead} locale={locale} />
                    </div>
                  </div>
                </article>

                {underLead.length > 0 ? (
                  <div data-block="under-lead" className="mt-6 grid gap-5 border-t border-ink pt-5 sm:grid-cols-2 sm:gap-0">
                    <div className="grid content-start gap-4 sm:border-r sm:border-line sm:pr-5">
                      {underLead.slice(0, 2).map((a) => (
                        <TextItem key={a.href} article={a} locale={locale} />
                      ))}
                    </div>
                    {underLead[2] ? (
                      <div className="sm:pl-5">
                        <CardItem article={underLead[2]} locale={locale} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside className="order-3 grid content-start gap-6">
                <AdSlot slot="square" locale={locale} />
                <LatestNews items={latest} locale={locale} />
              </aside>
            </div>

            {/* --- a row of four with pictures ----------------------------- */}
            {cards.length > 0 ? (
              <div data-block="cards" className="mt-10 border-t border-line pt-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:-mx-5 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line">
                {cards.map((a) => (
                  <div key={a.href} className="lg:px-5">
                    <CardItem article={a} locale={locale} />
                  </div>
                ))}
                </div>
              </div>
            ) : null}

            {/* --- more stories from this section, as a list ----------------- */}
            {list.length > 0 ? (
              <div className="mt-12 grid gap-10 border-t border-line pt-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-6">
                <div className="hidden lg:block" />
                <section data-block="list" className="min-w-0 lg:max-w-[46rem]">
                  <h2 className="mb-5 font-serif text-2xl font-bold text-brand">{copy.moreInSection(name)}</h2>
                  <div>
                    {list.map((a) => (
                      <ListItem key={a.href} article={a} locale={locale} />
                    ))}
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
