import Link from "next/link";
import { currentUser } from "@/lib/rbac";
import { SignOutButton } from "@/components/auth-buttons";
import { type Locale, localeMeta, localePath, other, sectionPath, t } from "@/lib/i18n";
import { siteSettings } from "@/lib/settings";

const SECTIONS = ["Politics", "Technology", "Culture", "Business"];

export async function SiteHeader({
  locale = "BN",
  switchHref,
}: {
  locale?: Locale;
  /** Where the language toggle goes; defaults to the same page in the other language. */
  switchHref?: string | null;
}) {
  const [user, site] = await Promise.all([currentUser(), siteSettings()]);
  const copy = t(locale);
  const siteName = locale === "BN" ? site.siteNameBn : site.siteNameEn;
  const alt = other(locale);
  const altHref = switchHref ?? localePath(alt);
  const base = localePath(locale);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={base} aria-label={siteName} className="shrink-0">
          {/* Width and height are fixed so the masthead never shifts the layout
              while it decodes. A plain <img> keeps the public pages free of the
              image optimiser round-trip. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.logoUrl || "/brand/the-document-masthead.png"}
            alt={siteName}
            width={1000}
            height={294}
            fetchPriority="high"
            className="h-9 w-auto sm:h-12"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-5 text-sm text-ink-soft lg:flex">
          <Link href={base} className="hover:text-ink">
            {copy.latest}
          </Link>
          {SECTIONS.map((s) => (
            <Link key={s} href={sectionPath(locale, s)} className="hover:text-ink">
              {copy.sections[s]}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          {/* The language switch is a deliberate, obvious button rather than a
              small link - most readers arrive on the Bangla site and need to
              find English without hunting for it. */}
          <Link
            href={altHref}
            hrefLang={localeMeta[alt].htmlLang}
            lang={localeMeta[alt].htmlLang}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-navy px-3 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:px-4"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0 fill-none stroke-current stroke-2">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
            </svg>
            {localeMeta[alt].short}
          </Link>

          {user ? (
            <>
              <Link
                href={user.role === "CONTRIBUTOR" ? "/dashboard" : "/editorial"}
                className="rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-dark"
              >
                {user.role === "CONTRIBUTOR" ? copy.myDesk : copy.newsroom}
              </Link>
              <Link
                href="/dashboard/account"
                className="hidden px-2 py-1.5 text-sm text-ink-soft hover:text-ink sm:inline"
              >
                {copy.account}
              </Link>
              <SignOutButton label={copy.signOut} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden px-2 py-1.5 text-sm text-ink-soft hover:text-ink sm:inline"
              >
                {copy.signIn}
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                {copy.writeForUs}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-ink-soft lg:hidden">
        <Link href={base} className="whitespace-nowrap hover:text-ink">
          {copy.latest}
        </Link>
        {SECTIONS.map((s) => (
          <Link key={s} href={sectionPath(locale, s)} className="whitespace-nowrap hover:text-ink">
            {copy.sections[s]}
          </Link>
        ))}
      </div>
    </header>
  );
}
