/**
 * The widths a photograph may be served at.
 *
 * Deliberately a tiny module with no dependencies: it is imported by client
 * components, and pulling the image library in behind it would drag sharp into
 * the browser bundle.
 */

/** A fixed list, so nobody can fill the disk by asking for a million sizes. */
export const WIDTHS = [320, 480, 640, 800, 1200, 1600] as const;
export type Width = (typeof WIDTHS)[number];

export const isWidth = (n: number): n is Width => (WIDTHS as readonly number[]).includes(n);

/** The srcset for a picture that is never shown wider than `max` CSS pixels. */
export function srcSetFor(url: string, max = 1200) {
  return WIDTHS.filter((w) => w <= max)
    .map((w) => `${url}?w=${w} ${w}w`)
    .join(", ");
}
