/**
 * Who goes where on the front page.
 *
 * One function decides it, used by the page itself and by the board the desk
 * arranges it on, so the board can never promise something the page will not
 * do.
 *
 * The rule: a position an editor pinned is theirs. Everything else is filled
 * with the newest published work, and the positions are filled in the order the
 * page gives them away - the lead, the two pieces directly under it, then the
 * left rail, then the right. Filling the rails first, which is what it used to
 * do, left the newest news in the gutters and put the eighth and ninth stories
 * under the main headline.
 */

export const SLOT_LIMIT = { LEAD: 1, STRIP: 3, LEFT: 3, MIDDLE: 2, RIGHT: 4 } as const;

export type SlotKey = keyof typeof SLOT_LIMIT;

/** Prominence order. STRIP is missing on purpose: the masthead strip fills
    itself from the headlines the page is not already showing. */
export const FILL_ORDER: SlotKey[] = ["LEAD", "MIDDLE", "LEFT", "RIGHT"];

export type FrontPagePlan<T> = {
  lead: T | null;
  underLead: T[];
  leftRail: T[];
  rightRail: T[];
  strip: T[];
  /** Everything the named positions did not take, newest first. */
  more: T[];
  /** What each position would be filled with if nothing were pinned there. */
  automatic: Record<SlotKey, T[]>;
};

export function planFrontPage<T>({
  featured,
  latest,
  pinned,
  key,
}: {
  /** Pieces an editor starred, most recently starred first. */
  featured: T[];
  /** Everything published, newest first. */
  latest: T[];
  /** What the desk pinned, by position. */
  pinned: Map<string, T[]>;
  key: (item: T) => string;
}): FrontPagePlan<T> {
  const spoken = new Set<string>();
  for (const list of pinned.values()) for (const item of list) spoken.add(key(item));

  const featuredKeys = new Set(featured.map(key));
  const pool = [
    ...featured.filter((a) => !spoken.has(key(a))),
    ...latest.filter((a) => !featuredKeys.has(key(a)) && !spoken.has(key(a))),
  ];

  const filled = {} as Record<SlotKey, T[]>;
  const automatic = { LEAD: [], STRIP: [], LEFT: [], MIDDLE: [], RIGHT: [] } as Record<SlotKey, T[]>;

  for (const slot of FILL_ORDER) {
    const here = (pinned.get(slot) ?? []).slice(0, SLOT_LIMIT[slot]);
    while (here.length < SLOT_LIMIT[slot] && pool.length) {
      const next = pool.shift()!;
      here.push(next);
      automatic[slot].push(next);
    }
    filled[slot] = here;
  }

  return {
    lead: filled.LEAD[0] ?? null,
    underLead: filled.MIDDLE,
    leftRail: filled.LEFT,
    rightRail: filled.RIGHT,
    strip: pinned.get("STRIP") ?? [],
    more: pool,
    automatic,
  };
}
