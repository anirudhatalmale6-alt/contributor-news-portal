import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { feedArticlesByAuthor } from "@/lib/articles";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleCard, TierBadge, SHELL } from "@/components/ui";
import { siteSettings } from "@/lib/settings";
import { banglaFontCss } from "@/lib/fonts";
import { type Locale, localeMeta, localeNumber, t } from "@/lib/i18n";

/** A contributor's public page: who they are, how to reach them, what they wrote. */
export async function AuthorPage({ locale, id }: { locale: Locale; id: string }) {
  const copy = t(locale);
  const site = await siteSettings();

  const author = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      tier: true,
      role: true,
      publicEmail: true,
      phone: true,
      phonePublic: true,
      website: true,
      location: true,
      suspendedAt: true,
    },
  });
  if (!author || author.suspendedAt) notFound();

  const articles = await feedArticlesByAuthor(locale, id, 24);

  return (
    <div
      lang={localeMeta[locale].htmlLang}
      style={{ "--bn-reading-font": banglaFontCss(site.banglaFont) } as React.CSSProperties}
    >
      <SiteHeader locale={locale} switchHref={locale === "BN" ? `/en/author/${id}` : `/author/${id}`} />
      <main className={`${SHELL} pb-16`}>
        <header className="flex flex-wrap items-start gap-5 border-b border-line py-8">
          <span className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper-soft">
            {author.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={author.image} alt="" className="size-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden className="size-12 fill-none stroke-ink-soft stroke-[1.5]">
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
              </svg>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-2xl font-bold sm:text-3xl">{author.name}</h1>
            <div className="mt-2">
              <TierBadge
                tier={author.tier}
                label={copy.verified}
                generalLabel={copy.contributor}
              />
            </div>
            {author.bio ? <p className="mt-3 text-sm leading-relaxed">{author.bio}</p> : null}

            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              {author.location ? <dd>{author.location}</dd> : null}
              {author.publicEmail ? (
                <dd>
                  <a href={`mailto:${author.publicEmail}`} className="hover:text-ink">
                    {author.publicEmail}
                  </a>
                </dd>
              ) : null}
              {/* A contributor's number is newsroom-only unless they opted in. */}
              {author.phone && author.phonePublic ? <dd>{author.phone}</dd> : null}
              {author.website ? (
                <dd>
                  <a
                    href={author.website}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                    className="hover:text-ink"
                  >
                    {author.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              ) : null}
            </dl>
          </div>
        </header>

        <section className="pt-6">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">
            {copy.byThisWriter(localeNumber(articles.length, locale))}
          </h2>

          {articles.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">{copy.nothingHere}</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <ArticleCard key={a.href} article={a} locale={locale} />
              ))}
            </div>
          )}
        </section>

        <p className="mt-10 text-sm">
          <Link href="/register" className="font-medium text-brand hover:underline">
            {copy.ctaButton}
          </Link>
        </p>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
