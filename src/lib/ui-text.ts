import { TEXT_DEFAULTS, type TextEntry } from "@/lib/text-defaults";
import type { Locale } from "@/lib/i18n";

/**
 * The wording the site is currently using.
 *
 * Deliberately free of any database import: this module is reachable from the
 * browser bundle through i18n, and pulling Prisma in behind it would break the
 * build. The server fills the map in from the database before anything renders;
 * see ui-text-store.ts.
 */

/** Keyed `BN:nav.signIn`, so one map holds both languages. */
let overrides: Record<string, string> = {};

export function setTextOverrides(next: Record<string, string>) {
  overrides = next;
}

export function currentOverrides() {
  return overrides;
}

const fallback = (entry: TextEntry, locale: Locale) => (locale === "BN" ? entry.bn : entry.en);

/** Fills `{name}` style holes. A value with no holes is returned untouched. */
export function fillPlaceholders(value: string, vars?: Record<string, string | number>) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * One line of wording: what the owner wrote if he wrote one, otherwise what the
 * site shipped with. An unknown key returns the key itself rather than an empty
 * space, so a mistake is visible rather than invisible.
 */
export function text(key: string, locale: Locale, vars?: Record<string, string | number>) {
  const entry = TEXT_DEFAULTS[key];
  const value = overrides[`${locale}:${key}`] ?? (entry ? fallback(entry, locale) : key);
  return fillPlaceholders(value, vars);
}

/** Every line, with what it says now and what it shipped as. For the editor. */
export function allText(locale: Locale) {
  return Object.entries(TEXT_DEFAULTS).map(([key, entry]) => ({
    key,
    group: entry.group,
    note: entry.note ?? "",
    shipped: fallback(entry, locale),
    value: overrides[`${locale}:${key}`] ?? "",
  }));
}

/**
 * Every line in the named groups, resolved, as a plain object.
 *
 * For screens that are client components: they cannot read the wording
 * themselves, so the server hands them the words they need as a prop.
 */
export function textGroups(groups: string[], locale: Locale) {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(TEXT_DEFAULTS)) {
    if (groups.includes(entry.group)) out[key] = text(key, locale);
  }
  return out;
}
