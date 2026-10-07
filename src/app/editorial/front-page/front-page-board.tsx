"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Piece = {
  id: string;
  title: string;
  category: string;
  coverImage: string | null;
  author: string;
  publishedAt: string | null;
  homeSlot: string | null;
};

const SLOTS = [
  { key: "LEAD", label: "Main headline", hint: "The big story in the middle, with the large picture.", max: 1 },
  { key: "STRIP", label: "Beside the masthead", hint: "The three small headlines to the right of the logo.", max: 3 },
  { key: "LEFT", label: "Left column", hint: "Also today, down the left-hand side.", max: 3 },
  { key: "MIDDLE", label: "Under the headline", hint: "The two pieces directly beneath the main story.", max: 2 },
  { key: "RIGHT", label: "Right column", hint: "More from our contributors, down the right-hand side.", max: 4 },
] as const;

/**
 * The front page, as a thing you arrange rather than a thing that happens.
 *
 * Every position lists what is pinned there and what it will fall back to. A
 * position left empty is not a hole: the page fills it with the newest work,
 * which is why an editor can plan the top of the page and ignore the rest.
 */
export function FrontPageBoard({ pinned, pool }: { pinned: Piece[]; pool: Piece[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function place(articleId: string, homeSlot: string | null, homeOrder = 0) {
    setBusy(articleId);
    setMessage(null);
    const res = await fetch(`/api/editorial/${articleId}/home-slot`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeSlot, homeOrder }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not move that piece." });
      return;
    }
    setAdding(null);
    setQuery("");
    setMessage({
      kind: "ok",
      text: homeSlot
        ? `Placed. The front page shows it in ${SLOTS.find((s) => s.key === homeSlot)?.label.toLowerCase()} now.`
        : "Taken off the front page. The page will fill that space on its own.",
    });
    router.refresh();
  }

  const inSlot = (key: string) =>
    pinned.filter((p) => p.homeSlot === key).sort((a, b) => a.title.localeCompare(b.title));

  const candidates = pool
    .filter((p) => !p.homeSlot)
    .filter((p) =>
      query.trim()
        ? `${p.title} ${p.author}`.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    )
    .slice(0, 12);

  return (
    <div className="grid gap-5">
      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {SLOTS.map((slot) => {
        const here = inSlot(slot.key);
        const room = here.length < slot.max;
        return (
          <section key={slot.key} className="rounded-xl border border-line">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3">
              <h2 className="font-serif text-lg font-bold">{slot.label}</h2>
              <span className="text-xs text-ink-soft">{slot.hint}</span>
              <span className="ml-auto text-xs text-ink-soft">
                {here.length} of {slot.max}
              </span>
            </div>

            <ul className="divide-y divide-line">
              {here.length === 0 ? (
                <li className="px-4 py-3 text-sm text-ink-soft">
                  Empty. The front page fills this with the newest published work.
                </li>
              ) : null}
              {here.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.coverImage} alt="" className="size-12 shrink-0 rounded object-cover" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.title}</span>
                    <span className="block text-xs text-ink-soft">
                      {p.category} · {p.author}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void place(p.id, null)}
                    disabled={busy === p.id}
                    className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-rose-300 hover:text-rose-800 disabled:opacity-60"
                  >
                    {busy === p.id ? "Removing..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-4 py-3">
              {adding === slot.key ? (
                <div className="grid gap-2">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search published articles by headline or writer"
                    className="w-full rounded-full border border-line px-3.5 py-2 text-sm outline-none focus:border-navy"
                  />
                  <ul className="grid max-h-72 gap-1 overflow-y-auto">
                    {candidates.length === 0 ? (
                      <li className="py-2 text-sm text-ink-soft">Nothing matches that.</li>
                    ) : null}
                    {candidates.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => void place(p.id, slot.key, here.length)}
                          disabled={busy === p.id}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-paper-soft disabled:opacity-60"
                        >
                          {p.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.coverImage}
                              alt=""
                              className="size-10 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <span className="size-10 shrink-0 rounded bg-paper-soft" />
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{p.title}</span>
                            <span className="block text-xs text-ink-soft">
                              {p.category} · {p.author}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(null);
                      setQuery("");
                    }}
                    className="justify-self-start text-xs text-ink-soft hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(slot.key)}
                  disabled={!room}
                  className="rounded-full border border-navy px-3.5 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white disabled:border-line disabled:text-ink-soft disabled:hover:bg-transparent"
                >
                  {room ? "Add an article" : "Full - remove one first"}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
