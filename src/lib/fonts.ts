/**
 * Bengali reading faces the owner can choose between in Admin.
 *
 * Prothom Alo reads in "Shurjo", which is their own licensed typeface and not
 * ours to ship. These are the closest freely licensed equivalents, all
 * self-hosted so the pages still make no third-party requests.
 */
export const BANGLA_FONTS = [
  {
    value: "hind-siliguri",
    css: '"Hind Siliguri"',
    label: "Hind Siliguri",
    note: "Modern humanist, closest to the face Prothom Alo uses",
  },
  {
    value: "anek-bangla",
    css: '"Anek Bangla"',
    label: "Anek Bangla",
    note: "Contemporary, slightly narrower, good on phones",
  },
  {
    value: "tiro-bangla",
    css: '"Tiro Bangla"',
    label: "Tiro Bangla",
    note: "Traditional newspaper serif",
  },
  {
    value: "noto-serif-bengali",
    css: '"Noto Serif Bengali"',
    label: "Noto Serif Bengali",
    note: "The classic bookish serif",
  },
] as const;

export const banglaFontCss = (value: string) =>
  BANGLA_FONTS.find((f) => f.value === value)?.css ?? '"Hind Siliguri"';
