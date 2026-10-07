import Link from "next/link";
import { currentUser } from "@/lib/rbac";
import { SignedInBar } from "@/components/signed-in-bar";
import { SHELL } from "@/components/ui";
import { feedArticles } from "@/lib/articles";
import { MENU_CATEGORIES, type Locale, localeMeta, localePath, other, sectionPath, t } from "@/lib/i18n";
import { siteSettings } from "@/lib/settings";

export async function SiteHeader({
  locale = "EN",
  switchHref,
  activeCategory,
  teasers = false,
  teaserExclude = [],
  teaserNever,
  teaserPinned = [],
}: {
  locale?: Locale;
  /** Where the language toggle goes; defaults to the same page in the other language. */
  switchHref?: string | null;
  /** Marks the current section, so the page does not need a second menu. */
  activeCategory?: string;
  /** The three headlines beside the masthead. Public pages only - the newsroom
      screens do not need them and should not pay for the query. */
  teasers?: boolean;
  /** Hrefs the page already shows below. The strip prefers anything else, but
      falls back to these rather than standing empty on a young site. */
  teaserExclude?: string[];
  /** The one piece the strip must never carry: the lead, directly beneath it. */
  teaserNever?: string;
  /** Hrefs an editor pinned to the strip. These go first, in their order. */
  teaserPinned?: string[];
}) {
  const [user, site, pool] = await Promise.all([
    currentUser(),
    siteSettings(),
    teasers ? feedArticles(locale, "All", 10) : Promise.resolve([]),
  ]);
  const shown = new Set(teaserExclude);
  const allowed = pool.filter((a) => a.href !== teaserNever);
  const pinnedFirst = teaserPinned
    .map((href) => allowed.find((a) => a.href === href))
    .filter((a): a is (typeof allowed)[number] => Boolean(a));
  const pinnedHrefs = new Set(pinnedFirst.map((a) => a.href));
  const strip = [
    ...pinnedFirst,
    ...allowed.filter((a) => !pinnedHrefs.has(a.href) && !shown.has(a.href)),
    ...allowed.filter((a) => !pinnedHrefs.has(a.href) && shown.has(a.href)),
  ].slice(0, 3);
  const copy = t(locale);
  const siteName = locale === "BN" ? site.siteNameBn : site.siteNameEn;
  const alt = other(locale);
  const altHref = switchHref ?? localePath(alt);
  const base = localePath(locale);

  // An uploaded masthead is a photograph like any other and was being sent at
  // full size on every single page. The packaged default is already small.
  const logo = site.logoUrl || "/brand/the-document-masthead.png";
  const uploaded = logo.startsWith("/media/");
  const logoSrc = uploaded ? `${logo}?w=640` : logo;
  const logoSet = uploaded ? `${logo}?w=320 320w, ${logo}?w=640 640w` : undefined;

  return (
    <>
      {/* The strip sits above the masthead. It used to sit below the section
          bar, and because that bar is sticky it slid over the strip the moment
          the reader scrolled - which is what made the top of the page look
          like two things fighting for the same space on a phone. */}
      <SignedInBar />

      <header lang={localeMeta[locale].htmlLang} className="border-b border-line bg-paper">
        {/* Masthead row: the logo on the left, and - as on the papers he sent -
            a strip of the newest headlines filling the space beside it. */}
        <div className={`${SHELL} flex items-center gap-3 py-3 sm:gap-6 sm:py-4`}>
          <Link href={base} aria-label={siteName} className="shrink-0">
            {/* Width and height are fixed so the masthead never shifts the layout
                while it decodes. A plain <img> keeps the public pages free of the
                image optimiser round-trip. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              srcSet={logoSet}
              sizes="(min-width: 640px) 320px, 220px"
              alt={siteName}
              width={1000}
              height={294}
              fetchPriority="high"
              className="h-11 w-auto sm:h-16"
            />
          </Link>

          {strip.length > 0 ? (
            <ul className="hidden flex-1 items-stretch divide-x divide-line border-x border-line xl:flex">
              {strip.map((a) => (
                <li key={a.href} className="min-w-0 flex-1 px-4">
                  <Link href={a.href} className="group flex items-center gap-2.5">
                    {a.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${a.coverImage}?w=320`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-11 shrink-0 rounded object-cover"
                      />
                    ) : null}
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:underline">
                      {a.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex-1" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {/* The language switch is a deliberate, obvious button rather than a
                small link - most readers arrive on the Bangla site and need to
                find English without hunting for it. */}
            <Link
              href={altHref}
              hrefLang={localeMeta[alt].htmlLang}
              lang={localeMeta[alt].htmlLang}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-navy px-2.5 py-1 text-[13px] font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:px-4 sm:py-1.5 sm:text-sm"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="size-4 shrink-0 fill-none stroke-current stroke-2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
              </svg>
              {localeMeta[alt].short}
            </Link>

            {user ? (
              <Link
                href={user.role === "CONTRIBUTOR" ? "/dashboard" : "/editorial"}
                className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-dark"
              >
                {user.role === "CONTRIBUTOR" ? copy.myDesk : copy.newsroom}
              </Link>
            ) : (
              /* Account and Sign out live in the strip below, so the same links
                 never appear twice on one screen. */
              <>
                {/* A phone has room for one of these, not both - the sign-in
                    link is the one a returning reader needs. */}
                <Link
                  href="/login"
                  className="px-2 py-1.5 text-[13px] text-ink-soft hover:text-ink sm:text-sm"
                >
                  {copy.signIn}
                </Link>
                <Link
                  href="/register"
                  className="hidden rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark sm:inline-block"
                >
                  {copy.writeForUs}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* The section bar, and the only section menu on the page. It scrolls
          sideways on a phone and sits inline on a desktop - never both, which
          is what made it look like two menus. */}
      <nav className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className={`${SHELL} no-scrollbar flex gap-1 overflow-x-auto py-2 text-base lg:gap-0 lg:text-[15px]`}>
          <Link
            href={base}
            aria-current={!activeCategory ? "page" : undefined}
            className={`whitespace-nowrap rounded px-3 py-2 font-medium lg:py-1.5 ${
              !activeCategory ? "bg-navy text-white lg:bg-transparent lg:text-brand" : "text-ink-soft hover:text-ink"
            }`}
          >
            {copy.latest}
          </Link>
          {MENU_CATEGORIES.map((s) => (
            <Link
              key={s}
              href={sectionPath(locale, s)}
              aria-current={activeCategory === s ? "page" : undefined}
              className={`whitespace-nowrap rounded px-3 py-2 font-medium lg:py-1.5 ${
                activeCategory === s
                  ? "bg-navy text-white lg:bg-transparent lg:text-brand"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {copy.sections[s]}
            </Link>
          ))}
        </div>
      </nav>

    </>
  );
}
