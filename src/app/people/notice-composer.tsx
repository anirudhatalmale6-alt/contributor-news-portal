"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Putting a notice on somebody's dashboard - or on everybody's.
 *
 * Deliberately one control with an audience, not two features: "tell every
 * contributor" and "tell this contributor" are the same act with a different
 * reader, and splitting them would mean two screens to keep in step.
 */
export function NoticeComposer({
  person,
  live,
}: {
  /** Omitted means the notice is for every contributor. */
  person?: { id: string; name: string };
  /** Notices already up, so the desk can take one down. */
  live: { id: string; body: string; forEveryone: boolean; seenBy: number }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function post() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, ...(person ? { userId: person.id } : {}) }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not post that notice." });
      return;
    }
    setBody("");
    setMessage({
      kind: "ok",
      text: person
        ? `${person.name} will see this the next time they open their desk.`
        : "Every contributor will see this on their desk until they close it.",
    });
    router.refresh();
  }

  async function takeDown(id: string) {
    await fetch(`/api/notices/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="grid gap-3 rounded-xl border border-line p-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
        {person ? `Notice for ${person.name}` : "Notice for every contributor"}
      </h2>
      <p className="text-xs text-ink-soft">
        {person
          ? "Sits at the top of their desk until they read it and press Got it."
          : "Sits at the top of every contributor's desk until each of them closes it. One person closing it does not take it off anybody else's screen."}
      </p>

      {message ? (
        <p
          role="status"
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <textarea
        name="notice-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What should they know?"
        className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
      />
      <button
        type="button"
        name="post-notice"
        onClick={() => void post()}
        disabled={busy || body.trim().length < 3}
        className="justify-self-start rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
      >
        {busy ? "Posting..." : "Post the notice"}
      </button>

      {live.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line pt-2 text-sm">
          {live.map((n) => (
            <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block whitespace-pre-wrap">{n.body}</span>
                <span className="text-xs text-ink-soft">
                  {n.forEveryone ? "Everyone" : "Just them"} · read by {n.seenBy}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void takeDown(n.id)}
                className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium hover:border-rose-300 hover:text-rose-800"
              >
                Take down
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
