"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Key = "toEnglish" | "toBangla" | "summary" | "polish";

const BOXES: { key: Key; label: string; note: string }[] = [
  { key: "toEnglish", label: "Translating into English", note: "Used by the translate button on a Bangla piece." },
  { key: "toBangla", label: "Translating into Bangla", note: "Used by the translate button on an English piece." },
  {
    key: "summary",
    label: "The one-line summary for the feed",
    note: "Written automatically when a piece is submitted, and by Write with AI.",
  },
  { key: "polish", label: "Polish with AI", note: "Used by the Polish with AI button on the review screen." },
];

/**
 * The owner's own instructions to the AI, one box per job. Whatever he writes
 * here, the site adds fixed rules after it - never invent or drop a fact, keep
 * quotes exact, keep the formatting - so the instructions can change the style
 * but not make the AI unsafe to publish from.
 */
export function AiInstructionsForm({
  current,
  shipped,
}: {
  current: Record<Key, string>;
  shipped: Record<Key, string>;
}) {
  const router = useRouter();
  const [form, setForm] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai-instructions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save the instructions." });
      return;
    }
    setMessage({ kind: "ok", text: "Instructions saved. The next AI request uses them." });
    router.refresh();
  }

  return (
    <section id="ai-instructions" className="mb-6 grid gap-4 rounded-xl border border-line p-4">
      <div>
        <h2 className="font-serif text-lg font-bold">AI instructions</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Tell the AI how you want each job done, in your own words. Whatever you write, the site
          always adds its own rules after it: never invent or leave out a fact, a name or a number,
          keep quotations exact, and keep the formatting. So you can change the style, but not
          make it make things up.
        </p>
      </div>

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

      {BOXES.map((box) => (
        <label key={box.key} className="grid gap-1 text-sm">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{box.label}</span>
            {form[box.key] !== shipped[box.key] ? (
              <button
                type="button"
                onClick={() => setForm({ ...form, [box.key]: shipped[box.key] })}
                className="text-xs font-medium text-navy hover:underline"
              >
                Back to the original wording
              </button>
            ) : null}
          </span>
          <textarea
            name={`ai-${box.key}`}
            value={form[box.key]}
            onChange={(e) => setForm({ ...form, [box.key]: e.target.value })}
            rows={3}
            maxLength={4000}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <span className="text-xs text-ink-soft">{box.note}</span>
        </label>
      ))}

      <button
        type="button"
        name="save-ai-instructions"
        onClick={() => void save()}
        disabled={busy}
        className="justify-self-start rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save instructions"}
      </button>
    </section>
  );
}
