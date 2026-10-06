/**
 * Two languages, one newsroom.
 *
 * Bangla is the default site and lives at `/`; English sits under `/en`. The UI
 * strings below cover the public chrome; the articles themselves come from the
 * database (an original plus the other-language version).
 */

export type Locale = "EN" | "BN";

export const LOCALES: Locale[] = ["BN", "EN"];

/** The language a reader gets if they just type the domain. */
export const DEFAULT_LOCALE: Locale = "BN";

export const localeMeta: Record<Locale, { htmlLang: string; label: string; short: string }> = {
  EN: { htmlLang: "en", label: "English", short: "English" },
  BN: { htmlLang: "bn", label: "বাংলা", short: "বাংলা" },
};

export const other = (locale: Locale): Locale => (locale === "EN" ? "BN" : "EN");

/** Section pages: /section/politics, /en/section/politics. */
export const sectionPath = (locale: Locale, category: string) =>
  localePath(locale, `/section/${category.toLowerCase()}`);

/** The category behind a section slug, or null if nobody publishes under it. */
export const CATEGORIES = ["Politics", "Technology", "Culture", "Business", "General"] as const;
export const categoryFromSlug = (slug: string) =>
  CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase()) ?? null;

/** Bangla is the root site; English is prefixed with `/en`. */
export const localePath = (locale: Locale, path = "") =>
  locale === "EN" ? `/en${path}` : path || "/";

type Dict = {
  latest: string;
  sections: Record<string, string>;
  alsoToday: string;
  featured: string;
  relatedTitle: string;
  inSection: (name: string) => string;
  moreFromContributors: string;
  nothingHere: string;
  signIn: string;
  writeForUs: string;
  myDesk: string;
  newsroom: string;
  signOut: string;
  account: string;
  minRead: (n: string) => string;
  verified: string;
  contributor: string;
  about: (name: string) => string;
  defaultBio: string;
  moreMedia: string;
  evidenceTitle: string;
  evidenceNote: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  footerTagline: string;
  readInOther: string;
  notTranslatedYet: string;
  translatedBy: (name: string) => string;
  originalLanguageNote: string;
};

const EN_DICT: Dict = {
  latest: "Latest",
  sections: {
    All: "All",
    Politics: "Politics",
    Technology: "Technology",
    Culture: "Culture",
    Business: "Business",
    General: "General",
  },
  alsoToday: "Also today",
  featured: "Featured",
  relatedTitle: "More on this",
  inSection: (name) => `${name} news`,
  moreFromContributors: "More from our contributors",
  nothingHere: "Nothing published in this section yet.",
  signIn: "Sign in",
  writeForUs: "Write for us",
  myDesk: "My desk",
  newsroom: "Newsroom",
  signOut: "Sign out",
  account: "Account",
  minRead: (n) => `${n} min read`,
  verified: "Verified contributor",
  contributor: "Contributor",
  about: (name) => `About ${name}`,
  defaultBio: "Contributor at The Document.",
  moreMedia: "More media",
  evidenceTitle: "Evidence",
  evidenceNote:
    "Photographs and video filed with this report, checked and chosen by the desk.",
  ctaTitle: "Write for The Document",
  ctaBody:
    "Open an account, draft your piece with photos or video, and submit it. An editor reads every submission before it is published - and sets the payout you earn for it.",
  ctaButton: "Become a contributor",
  footerTagline: "news written by its readers, checked by its editors.",
  readInOther: "বাংলায় পড়ুন",
  notTranslatedYet: "This piece has not been translated yet.",
  translatedBy: (name) => `Translated by ${name}`,
  originalLanguageNote: "Originally written in Bangla",
};

const BN_DICT: Dict = {
  latest: "সর্বশেষ",
  sections: {
    All: "সব",
    Politics: "রাজনীতি",
    Technology: "প্রযুক্তি",
    Culture: "সংস্কৃতি",
    Business: "অর্থনীতি",
    General: "সাধারণ",
  },
  alsoToday: "আজকের আরও খবর",
  featured: "নির্বাচিত",
  relatedTitle: "আরও পড়ুন",
  inSection: (name) => `${name} সংবাদ`,
  moreFromContributors: "আমাদের লেখকদের আরও লেখা",
  nothingHere: "এই বিভাগে এখনও কিছু প্রকাশিত হয়নি।",
  signIn: "সাইন ইন",
  writeForUs: "আমাদের জন্য লিখুন",
  myDesk: "আমার ডেস্ক",
  newsroom: "নিউজরুম",
  signOut: "সাইন আউট",
  account: "অ্যাকাউন্ট",
  minRead: (n) => `${n} মিনিটের পড়া`,
  verified: "যাচাইকৃত লেখক",
  contributor: "লেখক",
  about: (name) => `${name} সম্পর্কে`,
  defaultBio: "দ্য ডকুমেন্ট-এর লেখক।",
  moreMedia: "আরও ছবি ও ভিডিও",
  evidenceTitle: "প্রমাণ",
  evidenceNote: "এই প্রতিবেদনের সঙ্গে জমা দেওয়া ছবি ও ভিডিও, সম্পাদকের যাচাই ও নির্বাচন করা।",
  ctaTitle: "দ্য ডকুমেন্ট-এ লিখুন",
  ctaBody:
    "অ্যাকাউন্ট খুলুন, ছবি বা ভিডিও সহ আপনার লেখা তৈরি করুন এবং জমা দিন। প্রকাশের আগে একজন সম্পাদক প্রতিটি লেখা পড়েন এবং আপনার সম্মানী নির্ধারণ করেন।",
  ctaButton: "লেখক হিসেবে যোগ দিন",
  footerTagline: "পাঠকদের লেখা, সম্পাদকদের যাচাই করা সংবাদ।",
  readInOther: "Read in English",
  notTranslatedYet: "এই লেখাটির অনুবাদ এখনও হয়নি।",
  translatedBy: (name) => `অনুবাদ: ${name}`,
  originalLanguageNote: "মূল লেখা ইংরেজিতে",
};

export const t = (locale: Locale): Dict => (locale === "BN" ? BN_DICT : EN_DICT);

/** 1,234 -> ১,২৩৪ so Bangla pages do not mix digit systems. */
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function localeNumber(value: number | string, locale: Locale) {
  const s = String(value);
  return locale === "BN" ? s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]) : s;
}

const BN_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export function localeDate(date: Date | string, locale: Locale) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (locale === "BN") {
    return `${localeNumber(d.getDate(), "BN")} ${BN_MONTHS[d.getMonth()]} ${localeNumber(
      d.getFullYear(),
      "BN",
    )}`;
  }
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
