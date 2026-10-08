/**
 * The small amount of HTML an advertising box holds when it holds a picture.
 *
 * An uploaded advertisement is one `<img>`, optionally wrapped in one `<a>` that
 * sends the click somewhere. Changing where the click goes should not mean
 * uploading the picture again, so these three functions read and rewrite that
 * wrapper in place. Pure string work, no node modules, so the browser and the
 * server can both use them and agree on the result.
 */

const ANCHOR = /^\s*<a\b[^>]*>([\s\S]*)<\/a>\s*$/i;

export const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const unescapeAttr = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** True when this box holds an uploaded picture rather than ad-network code. */
export function isPictureAd(html: string) {
  return /<img\b/i.test(html) && !/<script\b|<iframe\b/i.test(html);
}

/** Where a click on this advertisement currently goes, or "" if nowhere. */
export function adLink(html: string) {
  const wrapper = html.match(ANCHOR);
  if (!wrapper) return "";
  const href = html.match(/<a\b[^>]*\bhref="([^"]*)"/i);
  return href ? unescapeAttr(href[1]) : "";
}

/**
 * The same advertisement, pointed at a new address.
 *
 * An empty link takes the wrapper off again, which leaves the picture showing
 * but no longer clickable - the honest way to say "this advertiser has no page".
 */
export function withAdLink(html: string, link: string) {
  const inner = (html.match(ANCHOR)?.[1] ?? html).trim();
  if (!inner) return "";
  return link
    ? `<a href="${escapeAttr(link)}" target="_blank" rel="noopener sponsored">${inner}</a>`
    : inner;
}
