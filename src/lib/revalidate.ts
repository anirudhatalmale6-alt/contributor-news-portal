import { revalidatePath } from "next/cache";

/**
 * Throw away the cached public pages after the newsroom changes something.
 *
 * The front page, the section pages and the article pages are cached HTML with
 * a 60 second window, so a visitor is never waiting on the database. Without
 * this the desk changes a front-page position and then watches the old
 * arrangement sit there: stale-while-revalidate serves the OLD page one more
 * time even after the window passes, so it can take two loads and a minute to
 * see an edit. That reads as "the button did nothing".
 *
 * It clears everything under the root layout rather than guessing which
 * addresses were affected - one piece can appear on the front page, a section
 * page, its author's page and the strip beside the masthead, and a missed one
 * is a page showing news that is no longer true.
 */
export function refreshPublicPages() {
  revalidatePath("/", "layout");
}
