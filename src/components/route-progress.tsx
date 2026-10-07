"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The bar that appears the moment a headline is clicked.
 *
 * Deliberately not Next's `loading.tsx`: that streams the page shell
 * immediately, which means a missing article would answer 200 with a "not
 * found" body instead of a real 404 - bad for search engines and for anything
 * that checks status codes. Watching link clicks gives the reader the same
 * feedback and leaves the status codes alone.
 */
export function RouteProgress() {
  const pathname = usePathname();
  // The newsroom tabs change only the query string. Watching the path alone
  // meant the bar started and never stopped on those, which showed up as a
  // loading flash that would not go away.
  const search = useSearchParams().toString();
  const [busy, setBusy] = useState(false);

  // Any click on an internal link starts the bar.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = (event.target as HTMLElement | null)?.closest?.("a");
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || link.target === "_blank") return;
      if (/^[a-z]+:/i.test(href) && !href.startsWith("/")) return;

      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) {
        return;
      }
      setBusy(true);
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // The new page having rendered is the signal to stop.
  useEffect(() => {
    setBusy(false);
  }, [pathname, search]);

  // And a backstop: nothing should leave a progress bar running for ten
  // seconds, whatever went wrong.
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setBusy(false), 10_000);
    return () => clearTimeout(timer);
  }, [busy]);

  // A back/forward press cancels it too.
  useEffect(() => {
    const stop = () => setBusy(false);
    window.addEventListener("popstate", stop);
    return () => window.removeEventListener("popstate", stop);
  }, []);

  if (!busy) return null;

  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label="Loading"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60]"
    >
      <div className="h-1 w-full overflow-hidden bg-brand/15">
        <div className="h-full w-1/3 animate-[route_1s_ease-in-out_infinite] rounded-r bg-brand" />
      </div>
      <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-paper/90 shadow-sm ring-1 ring-line">
        <svg viewBox="0 0 24 24" aria-hidden className="size-5 animate-spin">
          <circle cx="12" cy="12" r="9" className="fill-none stroke-line stroke-[3]" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            className="fill-none stroke-brand stroke-[3]"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </div>
  );
}
