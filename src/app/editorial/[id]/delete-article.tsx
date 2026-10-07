"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Deleting a piece for good.
 *
 * Two steps, because there is no undo: the button arms a confirmation that
 * names the headline back at you. Admins and the owner only - an editor can
 * send a piece back, which can be put right, but this cannot.
 */
export function DeleteArticle({ articleId, title }: { articleId: string; title: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/editorial/${articleId}/delete`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Could not delete that article.");
      return;
    }
    router.push("/editorial?status=APPROVED&deleted=1");
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-rose-800">Delete</h2>

      {armed ? (
        <>
          <p className="text-sm">
            Delete <span className="font-semibold">{title || "this untitled draft"}</span> for good?
            It comes off the site immediately, along with its translation, its photos and its
            review history. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="rounded-full bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
            >
              {busy ? "Deleting..." : "Yes, delete it"}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              disabled={busy}
              className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium hover:bg-paper-soft"
            >
              Keep it
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Takes the piece off the site permanently. To hide something temporarily, send it back
            to the writer instead.
          </p>
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="justify-self-start rounded-full border border-rose-300 bg-paper px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"
          >
            Delete this article
          </button>
        </>
      )}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
