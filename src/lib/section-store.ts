import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/rbac";
import { sectionKeys } from "@/lib/sections";
import { primeUiText, saveUiText } from "@/lib/ui-text-store";
import { TEXT_DEFAULTS } from "@/lib/text-defaults";
import { slugify } from "@/lib/format";

/**
 * Changing the paper's sections. Server only.
 *
 * A section's key is what articles store and never changes. Its names are
 * wording (section.<key>), saved through the same store as the Wording screen,
 * so the two screens show the same thing. Its web address can change; old
 * addresses then stop working, which the Sections screen says before saving.
 */

/** Refuses a section that does not exist, so a piece can never be filed nowhere. */
export async function assertSection(key: string) {
  await primeUiText();
  if (!sectionKeys().includes(key)) throw new HttpError(422, "Choose one of the paper's sections");
}

/** The shipped name of a section, if it is one the site came with. */
const shipped = (key: string, locale: "EN" | "BN") => {
  const entry = TEXT_DEFAULTS[`section.${key}`];
  return entry ? (locale === "BN" ? entry.bn : entry.en) : "";
};

/** Stores the names, leaving out any that match the shipped wording. */
export async function saveSectionNames(key: string, en: string, bn: string) {
  await saveUiText([
    { key: `section.${key}`, locale: "EN", value: en.trim() === shipped(key, "EN") ? "" : en.trim() },
    { key: `section.${key}`, locale: "BN", value: bn.trim() === shipped(key, "BN") ? "" : bn.trim() },
  ]);
}

const slugOk = (slug: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);

export async function updateSections(
  input: { key: string; slug: string; position: number; inMenu: boolean; en: string; bn: string }[],
) {
  const existing = await prisma.section.findMany({ select: { key: true } });
  const known = new Set(existing.map((s) => s.key));
  const slugs = new Set<string>();
  for (const s of input) {
    if (!known.has(s.key)) throw new HttpError(422, `There is no section called ${s.key}`);
    if (!slugOk(s.slug)) {
      throw new HttpError(422, `"${s.slug}" cannot be a web address: small letters, numbers and dashes only`);
    }
    if (slugs.has(s.slug)) throw new HttpError(422, `Two sections cannot both use "${s.slug}"`);
    slugs.add(s.slug);
    if (!s.en.trim() || !s.bn.trim()) throw new HttpError(422, "Every section needs a name in both languages");
  }
  // Two steps, so swapping two addresses never collides with itself halfway.
  await prisma.$transaction([
    ...input.map((s) =>
      prisma.section.update({ where: { key: s.key }, data: { slug: `tmp-${s.key.toLowerCase()}-${Date.now()}` } }),
    ),
    ...input.map((s) =>
      prisma.section.update({
        where: { key: s.key },
        data: { slug: s.slug, position: s.position, inMenu: s.key === "General" ? false : s.inMenu },
      }),
    ),
  ]);
  for (const s of input) await saveSectionNames(s.key, s.en, s.bn);
  await primeUiText(true);
}

/** A key for a new section, from its English name: "Sports and games" -> "SportsAndGames". */
function keyFrom(name: string) {
  const words = slugify(name).split("-").filter(Boolean);
  const key = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return key && key !== "Article" ? key : `Section${Date.now()}`;
}

export async function addSection({ en, bn, slug }: { en: string; bn: string; slug?: string }) {
  if (!en.trim() || !bn.trim()) throw new HttpError(422, "Give the new section a name in both languages");
  let key = keyFrom(en);
  for (let n = 2; await prisma.section.findUnique({ where: { key } }); n++) key = `${keyFrom(en)}${n}`;
  let address = slug?.trim() || slugify(en);
  if (!slugOk(address)) throw new HttpError(422, "The web address can use only small letters, numbers and dashes");
  for (let n = 2; await prisma.section.findUnique({ where: { slug: address } }); n++) {
    address = `${slug?.trim() || slugify(en)}-${n}`;
  }
  const last = await prisma.section.aggregate({ _max: { position: true } });
  // New sections go just before "General", which always stays last.
  const general = await prisma.section.findUnique({ where: { key: "General" } });
  const position = general ? general.position : (last._max.position ?? 0) + 1;
  if (general) await prisma.section.update({ where: { key: "General" }, data: { position: position + 1 } });
  await prisma.section.create({ data: { key, slug: address, position, inMenu: true } });
  await saveUiText([
    { key: `section.${key}`, locale: "EN", value: en.trim() },
    { key: `section.${key}`, locale: "BN", value: bn.trim() },
  ]);
  await primeUiText(true);
  return key;
}

/**
 * Removes a section. Its articles have to go somewhere: they move to the
 * section chosen, and only then is it deleted. "General" cannot be deleted.
 */
export async function deleteSection(key: string, moveTo: string | null) {
  if (key === "General") throw new HttpError(409, "General holds older pieces and cannot be deleted");
  const section = await prisma.section.findUnique({ where: { key } });
  if (!section) throw new HttpError(404, "That section no longer exists");
  const count = await prisma.article.count({ where: { category: key } });
  if (count > 0) {
    if (!moveTo) throw new HttpError(409, `This section has ${count} articles. Choose where to move them first.`);
    if (moveTo === key || !(await prisma.section.findUnique({ where: { key: moveTo } }))) {
      throw new HttpError(422, "Choose another section to move its articles to");
    }
  }
  await prisma.$transaction([
    prisma.article.updateMany({ where: { category: key }, data: { category: moveTo ?? "General", sectionLead: false } }),
    prisma.section.delete({ where: { key } }),
    prisma.uiText.deleteMany({ where: { key: `section.${key}` } }),
  ]);
  await primeUiText(true);
  return count;
}
