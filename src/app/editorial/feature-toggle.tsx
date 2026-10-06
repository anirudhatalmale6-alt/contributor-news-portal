"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Put a published piece on the front page, or take it off again. Lives next to
 * each row in the queue so the front page can be arranged without opening
 * every article.
 */
export function FeatureToggle({
  articleId,
  initial,
  disabled,
}: {
  articleId: string;
  initial: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [featured, setFeatured] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/editorial/${articleId}/feature`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: !featured }),
    });
    setBusy(false);
    if (!res.ok) return;
    setFeatured(!featured);
    router.refresh();
  }

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={featured}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        featured
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-line text-ink-soft hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 20 20" aria-hidden className={`size-3.5 ${featured ? "fill-amber-500" : "fill-none stroke-current"}`}>
        <path
          d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.5 8l5.2-.8L10 2.5z"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {featured ? "On the front page" : "Feature on front page"}
    </button>
  );
}
