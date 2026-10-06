import { siteSettings } from "@/lib/settings";

type Slot = "home" | "article" | "section";

/**
 * An advertising slot the owner controls from Admin.
 *
 * The HTML is whatever the ad network gives you, pasted by an Admin and stored
 * in the database, so it is rendered as-is. Nobody below Admin can write to
 * that field. When advertising is switched off, or the box for this slot is
 * empty, the component renders nothing at all - no empty gap in the page.
 */
export async function AdSlot({ slot, className = "" }: { slot: Slot; className?: string }) {
  const settings = await siteSettings();
  if (!settings.adsEnabled) return null;

  const html =
    slot === "home"
      ? settings.adHomeHtml
      : slot === "article"
        ? settings.adArticleHtml
        : settings.adSectionHtml;

  if (!html.trim()) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`my-8 overflow-hidden rounded-xl border border-line bg-paper-soft p-3 text-center ${className}`}
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-ink-soft">
        Advertisement
      </p>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
}
