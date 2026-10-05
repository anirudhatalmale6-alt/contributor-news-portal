import Link from "next/link";
import { currentUser } from "@/lib/rbac";
import { SignOutButton } from "@/components/auth-buttons";
import { type Locale, localeMeta, localePath, other, t } from "@/lib/i18n";

const SECTIONS = ["Politics", "Technology", "Culture", "Business"];

export async function SiteHeader({
  locale = "EN",
  switchHref,
}: {
  locale?: Locale;
  /** Where the language toggle goes; defaults to the same page in the other language. */
  switchHref?: string | null;
}) {
  const user = await currentUser();
  const copy = t(locale);
  const alt = other(locale);
  const altHref = switchHref ?? localePath(alt);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={localePath(locale)} aria-label="The Document" className="shrink-0">
          {/* Width and height are fixed so the masthead never shifts the layout
              while it decodes. A plain <img> keeps the public pages free of the
              image optimiser round-trip. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/the-document-masthead.png"
            alt="The Document"
            width={1000}
            height={259}
            fetchPriority="high"
            className="h-9 w-auto sm:h-12"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-5 text-sm text-ink-soft md:flex">
          <Link href={localePath(locale)} className="hover:text-ink">
            {copy.latest}
          </Link>
          {SECTIONS.map((s) => (
            <Link
              key={s}
              href={`${localePath(locale)}${localePath(locale) === "/" ? "" : ""}?category=${s}`}
              className="hover:text-ink"
            >
              {copy.sections[s]}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-4">
          <Link
            href={altHref}
            hrefLang={localeMeta[alt].htmlLang}
            lang={localeMeta[alt].htmlLang}
            className="rounded-full border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-navy hover:text-navy"
          >
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
              <SignOutButton label={copy.signOut} />
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1.5 text-sm text-ink-soft hover:text-ink">
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

      <div className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-4 pb-2 text-sm text-ink-soft md:hidden">
        <Link href={localePath(locale)} className="whitespace-nowrap hover:text-ink">
          {copy.latest}
        </Link>
        {SECTIONS.map((s) => (
          <Link
            key={s}
            href={`${localePath(locale)}?category=${s}`}
            className="whitespace-nowrap hover:text-ink"
          >
            {copy.sections[s]}
          </Link>
        ))}
      </div>
    </header>
  );
}
