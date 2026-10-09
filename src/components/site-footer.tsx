import Link from "next/link";
import { SHELL } from "@/components/ui";
import { type Locale, localeDate, localePath, t } from "@/lib/i18n";
import { siteSettings } from "@/lib/settings";
import { text } from "@/lib/ui-text";

export async function SiteFooter({ locale = "EN" }: { locale?: Locale }) {
  const copy = t(locale);
  const site = await siteSettings();
  const siteName = locale === "BN" ? site.siteNameBn : site.siteNameEn;
  const tagline = locale === "BN" ? site.taglineBn : site.taglineEn;
  const legal = locale === "BN" ? site.footerBn : site.footerEn;

  // Links the owner adds in Settings. An address left empty hides its link
  // rather than printing one that goes nowhere.
  const extra = [
    { href: site.footerAboutUrl, label: text("footer.about", locale) },
    { href: site.footerContactUrl, label: text("footer.contact", locale) },
    { href: site.footerPrivacyUrl, label: text("footer.privacy", locale) },
  ].filter((link) => link.href.trim());

  return (
    <footer lang={locale === "BN" ? "bn" : "en"} className="border-t border-line bg-paper-soft">
      <div className={`${SHELL} flex flex-col gap-3 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between`}>
        <p className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* 24px tall, so a 320px copy is already generous. */}
          <img
            src={
              site.logoUrl?.startsWith("/media/")
                ? `${site.logoUrl}?w=320`
                : site.logoUrl || "/brand/the-document-mark.png"
            }
            alt=""
            width={214}
            height={235}
            loading="lazy"
            decoding="async"
            className="h-6 w-auto"
          />
          <span>
            <span className="font-semibold text-ink">{siteName}</span> - {tagline}
          </span>
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link href={localePath(locale)} className="hover:text-ink">
            {copy.latest}
          </Link>
          <Link href="/register" className="hover:text-ink">
            {copy.writeForUs}
          </Link>
          <Link href="/login" className="hover:text-ink">
            {copy.signIn}
          </Link>
          {extra.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
          <span className="text-xs text-ink-soft">{legal}</span>
        </nav>
      </div>

      {/* Today's date, in the language of the page - Bangla digits on the
          Bangla side. Rendered on the server at request time, which is why the
          public pages clear their cache on every change rather than holding a
          day-old date. */}
      {site.footerShowDate ? (
        <div className={`${SHELL} border-t border-line py-3 text-center text-xs text-ink-soft`}>
          {localeDate(new Date(), locale)}
        </div>
      ) : null}
    </footer>
  );
}
