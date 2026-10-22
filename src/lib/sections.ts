/**
 * The paper's sections, as the running site knows them.
 *
 * Kept free of any database import, like ui-text.ts, because i18n.ts reaches
 * the browser. The server fills this in from the Section table alongside the
 * wording (see ui-text-store.ts); until then, or if the database cannot be
 * reached, the list the site shipped with is used, so the menu is never empty.
 */

export type SectionRow = { key: string; slug: string; position: number; inMenu: boolean };

const SHIPPED: SectionRow[] = [
  "Politics",
  "LawAndOrder",
  "Technology",
  "Economy",
  "World",
  "Opinion",
  "Culture",
  "Literature",
  "Philosophy",
  "Science",
  "Entertainment",
  "Lifestyle",
  "Career",
  "General",
].map((key, position) => ({
  key,
  slug: key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
  position,
  inMenu: key !== "General",
}));

let rows: SectionRow[] = SHIPPED;

export function setSections(next: SectionRow[]) {
  rows = next.length ? [...next].sort((a, b) => a.position - b.position) : SHIPPED;
}

/** Every section, in menu order. "General" is always kept: old pieces live there. */
export const allSections = () => rows;
export const sectionKeys = () => rows.map((r) => r.key);
/** What the reader is offered in the top menu. */
export const menuSections = () => rows.filter((r) => r.inMenu).map((r) => r.key);

export const slugForSection = (key: string) =>
  rows.find((r) => r.key === key)?.slug ?? key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/** The section behind an address, or null. Older run-together addresses still work. */
export const sectionFromSlug = (slug: string) => {
  const s = slug.toLowerCase();
  return rows.find((r) => r.slug === s)?.key ?? rows.find((r) => r.key.toLowerCase() === s)?.key ?? null;
};
