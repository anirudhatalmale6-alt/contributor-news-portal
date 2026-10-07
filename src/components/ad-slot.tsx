import { siteSettings } from "@/lib/settings";

type Slot = "home" | "article" | "section" | "banner" | "square";

/**
 * An advertising slot the owner controls from Admin.
 *
 * The HTML is whatever the ad network gives you, pasted by an Admin and stored
 * in the database, so it is rendered as-is. Nobody below Admin can write to
 * that field. When advertising is switched off, or the box for this slot is
 * empty, the component renders nothing at all - no empty gap in the page.
 *
 * The shape matters: a leaderboard and a 300x250 square are different pieces of
 * code, and reserving the right amount of room stops the page jumping about as
 * the ad loads.
 */
export async function AdSlot({ slot, className = "" }: { slot: Slot; className?: string }) {
  const settings = await siteSettings();
  if (!settings.adsEnabled) return null;

  const html = {
    home: settings.adHomeHtml,
    article: settings.adArticleHtml,
    section: settings.adSectionHtml,
    banner: settings.adBannerHtml,
    square: settings.adSquareHtml,
  }[slot];

  if (!html.trim()) return null;

  // A banner runs the full width and stays short; a square holds its 300x250
  // footprint. The rest size themselves to whatever is pasted in.
  const shape =
    slot === "banner"
      ? "min-h-[100px] sm:min-h-[120px]"
      : slot === "square"
        ? "mx-auto aspect-square w-full max-w-[300px]"
        : "";

  return (
    <aside
      aria-label="Advertisement"
      className={`my-6 flex flex-col justify-center overflow-hidden rounded-lg border border-line bg-paper-soft p-3 text-center ${shape} ${className}`}
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-ink-soft">
        Advertisement
      </p>
      <div className="[&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
}
