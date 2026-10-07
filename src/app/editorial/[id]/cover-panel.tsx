"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The cover photo, as the desk controls it.
 *
 * Works the same whether a piece is waiting for review or already published -
 * a wrong cover on a live story is exactly when you most need to change it.
 */
export function CoverPanel({
  articleId,
  initialCover,
  published,
}: {
  articleId: string;
  initialCover: string | null;
  published: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState(initialCover);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);

    // Two steps on purpose: the file becomes a media row like any other, then
    // that row is named as the cover. The picture stays in the library either
    // way, so swapping covers never loses the previous one.
    const body = new FormData();
    body.append("file", file);
    body.append("articleId", articleId);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setMessage({ kind: "err", text: data.error ?? "Could not upload that image." });
      return;
    }

    const set = await fetch(`/api/editorial/${articleId}/media/${data.media.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ makeCover: true, isEvidence: false }),
    });
    setBusy(false);
    if (!set.ok) {
      setMessage({ kind: "err", text: "Uploaded, but could not set it as the cover." });
      return;
    }
    setCover(data.media.url);
    setMessage({
      kind: "ok",
      text: published
        ? "Cover changed. The live article shows the new picture."
        : "Cover set.",
    });
    router.refresh();
  }

  async function removeCover() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/editorial/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImage: null }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: "Could not remove the cover." });
      return;
    }
    setCover(null);
    setMessage({ kind: "ok", text: "Cover removed. The piece now runs without a photo." });
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-xl border border-line p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Cover photo</h2>

      {cover ? (
        <div className="overflow-hidden rounded-lg border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="aspect-16/9 w-full object-cover" />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          No cover photo. The piece will run as text only.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Working..." : cover ? "Upload a different cover" : "Upload a cover"}
        </button>
        {cover ? (
          <button
            type="button"
            onClick={() => void removeCover()}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
          >
            Remove cover
          </button>
        ) : null}
      </div>

      <p className="text-xs text-ink-soft">
        Landscape works best, around 1200 x 675. You can also promote any photo already attached
        below by pressing &quot;Make cover&quot; on it.
      </p>

      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
