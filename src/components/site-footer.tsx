import Link from "next/link";
import { type Locale, localePath, t } from "@/lib/i18n";

export function SiteFooter({ locale = "EN" }: { locale?: Locale }) {
  const copy = t(locale);
  return (
    <footer className="border-t border-line bg-paper-soft">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/the-document-mark.png"
            alt=""
            width={214}
            height={235}
            loading="lazy"
            className="h-6 w-auto"
          />
          <span>
            <span className="font-semibold text-ink">The Document</span> - {copy.footerTagline}
          </span>
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href={localePath(locale)} className="hover:text-ink">
            {copy.latest}
          </Link>
          <Link href="/register" className="hover:text-ink">
            {copy.writeForUs}
          </Link>
          <Link href="/login" className="hover:text-ink">
            {copy.signIn}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
