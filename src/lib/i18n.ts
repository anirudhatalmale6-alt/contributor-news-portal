import { menuSections, sectionFromSlug, sectionKeys, slugForSection } from "@/lib/sections";
/**
 * Two languages, one newsroom.
 *
 * Bangla is the default site and lives at `/`; English sits under `/en`. What
 * the chrome says comes from the editable wording table, so the owner changes a
 * label in Settings rather than asking for a deploy; the articles themselves
 * come from the database.
 */
import { text } from "@/lib/ui-text";

export type Locale = "EN" | "BN";


export const LOCALES: Locale[] = ["BN", "EN"];

/** The language a reader gets if they just type the domain. */
export const DEFAULT_LOCALE: Locale = "BN";

export const localeMeta: Record<Locale, { htmlLang: string; label: string; short: string }> = {
  EN: { htmlLang: "en", label: "English", short: "English" },
  BN: { htmlLang: "bn", label: "বাংলা", short: "বাংলা" },
};

export const other = (locale: Locale): Locale => (locale === "EN" ? "BN" : "EN");

/**
 * Sections now come from the Section table (see sections.ts), so the owner can
 * add, rename, reorder and hide them. These names are kept so the rest of the
 * site did not have to change how it asks.
 */
export const categorySlug = (category: string) => slugForSection(category);

export const sectionPath = (locale: Locale, category: string) =>
  localePath(locale, `/section/${slugForSection(category)}`);

/** Every section, in the owner's order. A function: the list can change while the site runs. */
export const categories = () => sectionKeys();
/** What the reader is offered in the top menu. */
export const menuCategories = () => menuSections();
/** The section behind a web address, or null. */
export const categoryFromSlug = (slug: string) => sectionFromSlug(slug);

/** Bangla is the root site; English is prefixed with `/en`. */
export const localePath = (locale: Locale, path = "") =>
  locale === "EN" ? `/en${path}` : path || "/";

type Dict = {
  latest: string;
  sections: Record<string, string>;
  alsoToday: string;
  featured: string;
  relatedTitle: string;
  byThisWriter: (n: string) => string;
  inSection: (name: string) => string;
  moreFromContributors: string;
  moreInSection: (name: string) => string;
  latestNews: string;
  moreOnThisStory: string;
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

/**
 * The words the public pages use.
 *
 * Every line comes from the editable wording table, so changing a label is
 * something the owner does in Settings rather than something that needs a
 * developer. The shape stays the same as before, which is why no page had to
 * change when the wording moved.
 */
export const t = (locale: Locale): Dict => {
  const s = (key: string, vars?: Record<string, string | number>) => text(key, locale, vars);
  return {
    latest: s("nav.latest"),
    sections: Object.fromEntries(
      [...sectionKeys(), "All"].map((c) => [c, s(`section.${c}`)]),
    ) as Record<string, string>,
    alsoToday: s("feed.alsoToday"),
    featured: s("feed.featured"),
    relatedTitle: s("article.relatedTitle"),
    byThisWriter: (n) => s("writer.byThisWriter", { n }),
    inSection: (name) => s("feed.inSection", { name }),
    moreFromContributors: s("feed.moreFromContributors"),
    moreInSection: (name) => s("feed.moreInSection", { name }),
    latestNews: s("feed.latestNews"),
    moreOnThisStory: s("article.moreOnThisStory"),
    nothingHere: s("feed.nothingHere"),
    signIn: s("nav.signIn"),
    writeForUs: s("nav.writeForUs"),
    myDesk: s("nav.myDesk"),
    newsroom: s("nav.newsroom"),
    signOut: s("nav.signOut"),
    account: s("nav.account"),
    minRead: (n) => s("article.minRead", { n }),
    verified: s("writer.verified"),
    contributor: s("writer.contributor"),
    about: (name) => s("writer.about", { name }),
    defaultBio: s("writer.defaultBio"),
    moreMedia: s("article.moreMedia"),
    evidenceTitle: s("article.evidenceTitle"),
    evidenceNote: s("article.evidenceNote"),
    ctaTitle: s("cta.title"),
    ctaBody: s("cta.body"),
    ctaButton: s("cta.button"),
    footerTagline: s("footer.tagline"),
    readInOther: s("lang.readInOther"),
    notTranslatedYet: s("lang.notTranslatedYet"),
    translatedBy: (name) => s("lang.translatedBy", { name }),
    originalLanguageNote: s("lang.originalLanguageNote"),
  };
};

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

/**
 * The sections offered in a writer's or editor's dropdown, with their names in
 * both languages. "General" only appears for a piece already filed there: it
 * is where old pieces wait to be re-filed, not somewhere to file new ones.
 * Built on the server and handed to the screen, because the browser does not
 * have the owner's current list.
 */
export const sectionOptions = (current?: string) =>
  sectionKeys()
    .filter((k) => k !== "General" || k === current)
    .map((k) => ({ key: k, en: t("EN").sections[k] ?? k, bn: t("BN").sections[k] ?? k }));

export type SectionOption = ReturnType<typeof sectionOptions>[number];
