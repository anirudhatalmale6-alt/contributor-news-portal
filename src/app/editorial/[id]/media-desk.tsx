"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  kind: string;
  url: string;
  caption: string | null;
  originalName: string | null;
  isEvidence: boolean;
};

/**
 * What the editor can do with everything a contributor sent in:
 * choose the cover, decide what readers see in the Evidence gallery, write
 * captions, and download the untouched original to work on.
 */
export function MediaDesk({
  articleId,
  initial,
  cover,
}: {
  articleId: string;
  initial: Item[];
  cover: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [coverUrl, setCoverUrl] = useState(cover);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch(`/api/editorial/${articleId}/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setNote(data.error ?? "Could not update that file.");
      return;
    }
    setItems((list) => list.map((m) => (m.id === id ? { ...m, ...data.media } : m)));
    if (data.cover) {
      setCoverUrl(data.cover);
      setNote("Cover photo set.");
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return;
    setItems((list) => list.filter((m) => m.id !== id));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-line p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Media from the contributor
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Nothing was attached to this piece.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Media from the contributor
        </h2>
        {note ? <span className="text-xs text-emerald-700">{note}</span> : null}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        Pick the cover, caption what readers need explained, and decide what appears in the public
        Evidence gallery. Download gives you the untouched original to edit and re-attach.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((m) => {
          const isCover = coverUrl === m.url;
          return (
            <li key={m.id} className="grid gap-2 rounded-lg border border-line p-3">
              <div className="relative overflow-hidden rounded-md bg-paper-soft">
                {m.kind === "VIDEO" ? (
                  <video src={m.url} controls preload="metadata" className="aspect-4/3 w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="aspect-4/3 w-full object-cover" />
                )}
                {isCover ? (
                  <span className="absolute left-2 top-2 rounded bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                    Cover
                  </span>
                ) : null}
              </div>

              <p className="truncate text-xs text-ink-soft" title={m.originalName ?? ""}>
                {m.originalName ?? m.kind.toLowerCase()}
              </p>

              <input
                defaultValue={m.caption ?? ""}
                placeholder="Caption for readers"
                onBlur={(e) => {
                  if (e.target.value !== (m.caption ?? "")) {
                    void patch(m.id, { caption: e.target.value || null });
                  }
                }}
                className="rounded-lg border border-line px-2 py-1.5 text-xs outline-none focus:border-navy"
              />

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy === m.id || isCover || m.kind !== "IMAGE"}
                  onClick={() => void patch(m.id, { makeCover: true })}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium hover:bg-paper-soft disabled:opacity-40"
                >
                  {isCover ? "Is the cover" : "Use as cover"}
                </button>

                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => void patch(m.id, { isEvidence: !m.isEvidence })}
                  aria-pressed={m.isEvidence}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 ${
                    m.isEvidence
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {m.isEvidence ? "In Evidence" : "Add to Evidence"}
                </button>

                <a
                  href={`${m.url}?download=1`}
                  download
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium hover:bg-paper-soft"
                >
                  Download original
                </a>

                <button
                  type="button"
                  disabled={busy === m.id}
                  onClick={() => void remove(m.id)}
                  className="rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
