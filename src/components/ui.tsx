import Link from "next/link";
import { money, readingTime } from "@/lib/format";
import { type Locale, localeDate, localeNumber, t } from "@/lib/i18n";
import type { LocalisedArticle } from "@/lib/articles";
import { CoverImage } from "@/components/cover-image";

/**
 * One grid for the whole public site. The masthead, the section bar, the front
 * page columns and the article column all start on this left edge, which is
 * what makes the pages look like one newspaper rather than three screens.
 */
export const SHELL = "mx-auto w-full max-w-[1280px] px-4 sm:px-6";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-paper-soft text-ink-soft border-line",
  SUBMITTED: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "In review",
  APPROVED: "Published",
  REJECTED: "Changes requested",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function TierBadge({
  tier,
  role,
  label,
  generalLabel,
}: {
  tier: string;
  role?: string;
  /** Lets the public pages pass the Bangla wording. */
  label?: string;
  generalLabel?: string;
}) {
  if (role === "ADMIN" || role === "EDITOR") {
    return (
      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800">
        {role === "ADMIN" ? "Admin" : "Editor"}
      </span>
    );
  }
  if (tier === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
        <svg viewBox="0 0 20 20" aria-hidden className="size-3 fill-sky-600">
          <path d="M10 1.5l2.1 1.6 2.6-.2.9 2.5 2.2 1.4-.9 2.5.9 2.5-2.2 1.4-.9 2.5-2.6-.2L10 18.5l-2.1-1.6-2.6.2-.9-2.5L2.2 13.2l.9-2.5-.9-2.5 2.2-1.4.9-2.5 2.6.2L10 1.5zm-1 10.9l4.3-4.3-1.1-1.1L9 10.2 7.3 8.5 6.2 9.6 9 12.4z" />
        </svg>
        {label ?? "Verified contributor"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-paper-soft px-2 py-0.5 text-xs font-medium text-ink-soft">
      {generalLabel ?? "Contributor"}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-brand/20 bg-brand/5" : "border-line bg-paper"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
      <p
        className={`mt-1 font-serif text-2xl font-bold tabular-nums sm:text-3xl ${
          accent ? "text-brand-dark" : ""
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function ArticleCard({
  article,
  locale = "EN",
  lead,
  compact,
}: {
  article: LocalisedArticle;
  locale?: Locale;
  lead?: boolean;
  /** Sits under the lead: no rule above it, and a smaller picture. */
  compact?: boolean;
}) {
  const copy = t(locale);
  const minutes = localeNumber(readingTime(article.body), locale);
  return (
    <article className={`group border-line ${lead || compact ? "" : "border-t pt-5"}`}>
      <Link href={article.href} className="block">
        {article.coverImage ? (
          <CoverImage
            src={article.coverImage}
            crop={article.coverCropHome}
            shape="home"
            eager={lead}
            className="mb-3 rounded"
          />
        ) : null}

        <p className="text-[13px] font-semibold uppercase tracking-wide text-brand sm:text-xs">
          {copy.sections[article.category] ?? article.category}
        </p>
        <h2
          className={`balance mt-1 font-serif font-bold leading-tight group-hover:underline ${
            lead
              ? "text-[30px] sm:text-[38px]"
              : compact
                ? "text-xl sm:text-lg"
                : "text-[20px] sm:text-[19px] lg:text-[17px]"
          }`}
        >
          {article.title}
        </h2>
        {article.dek ? (
          <p className={`mt-2 text-ink-soft ${lead ? "text-[17px] sm:text-lg" : "text-[15px] sm:text-sm"}`}>
            {article.dek}
          </p>
        ) : null}
      </Link>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        {article.author.id ? (
          <Link
            href={locale === "BN" ? `/author/${article.author.id}` : `/en/author/${article.author.id}`}
            className="font-medium text-ink hover:underline"
          >
            {article.author.name}
          </Link>
        ) : (
          <span className="font-medium text-ink">{article.author.name}</span>
        )}
        {article.author.tier === "VERIFIED" ? (
          <svg viewBox="0 0 20 20" aria-label={copy.verified} className="size-3.5 fill-sky-600">
            <path d="M10 1.5l2.1 1.6 2.6-.2.9 2.5 2.2 1.4-.9 2.5.9 2.5-2.2 1.4-.9 2.5-2.6-.2L10 18.5l-2.1-1.6-2.6.2-.9-2.5L2.2 13.2l.9-2.5-.9-2.5 2.2-1.4.9-2.5 2.6.2L10 1.5zm-1 10.9l4.3-4.3-1.1-1.1L9 10.2 7.3 8.5 6.2 9.6 9 12.4z" />
          </svg>
        ) : null}
        <span aria-hidden>·</span>
        {article.publishedAt ? <span>{localeDate(article.publishedAt, locale)}</span> : null}
        <span aria-hidden>·</span>
        <span>{copy.minRead(minutes)}</span>
      </p>
    </article>
  );
}

export function Money({ cents, currency }: { cents: number; currency: string }) {
  return <span className="tabular-nums">{money(cents, currency)}</span>;
}
