/**
 * Shown the moment a headline is clicked, while the article is fetched.
 *
 * A spinner plus the shape of the page it is loading: the reader sees
 * immediately that something is happening and roughly what is coming, which
 * reads faster than a blank screen even when the wait is identical.
 */
export function ArticleSkeleton() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 py-6 text-sm text-ink-soft">
        <svg viewBox="0 0 24 24" aria-hidden className="size-5 animate-spin">
          <circle cx="12" cy="12" r="9" className="fill-none stroke-line stroke-[3]" />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            className="fill-none stroke-brand stroke-[3]"
            strokeLinecap="round"
          />
        </svg>
        <span className="sr-only">Loading</span>
      </div>

      <div className="animate-pulse space-y-4">
        <div className="h-3 w-24 rounded bg-line" />
        <div className="h-8 w-full rounded bg-line" />
        <div className="h-8 w-4/5 rounded bg-line" />
        <div className="h-4 w-2/3 rounded bg-line/70" />
        <div className="h-px w-full bg-line" />
        <div className="aspect-16/9 w-full rounded-xl bg-line/70" />
        <div className="space-y-3 pt-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`h-4 rounded bg-line/60 ${i % 3 === 2 ? "w-3/4" : "w-full"}`} />
          ))}
        </div>
      </div>
    </main>
  );
}
