"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MediaItem = { id: string; kind: string; url: string; caption: string | null };

type ArticleState = {
  id: string;
  title: string;
  dek: string;
  body: string;
  category: string;
  status: string;
  slug: string;
  payoutCents: number;
  media: MediaItem[];
};

const CATEGORIES = ["General", "Politics", "Technology", "Culture", "Business"];

export function ReviewPanel({
  article,
  settings,
  authorTier,
}: {
  article: ArticleState;
  settings: { currency: string; suggestedCents: number; verifiedBonusPct: number };
  authorTier: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: article.title,
    dek: article.dek,
    body: article.body,
    category: article.category,
  });
  const [payout, setPayout] = useState((settings.suggestedCents / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(article.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdits() {
    setBusy("save");
    setMessage(null);
    const res = await fetch(`/api/editorial/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: "err", text: "Could not save the edits." });
      return;
    }
    setMessage({ kind: "ok", text: "Edits saved." });
    router.refresh();
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision);
    setMessage(null);

    // Always persist the editor's wording changes before the decision lands.
    await fetch(`/api/editorial/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const cents = Math.round(Number(payout.replace(/[^0-9.]/g, "")) * 100);
    const res = await fetch(`/api/editorial/${article.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        note: note.trim() || undefined,
        ...(decision === "APPROVE" ? { payoutCents: Number.isFinite(cents) ? cents : 0 } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);

    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not record the decision." });
      return;
    }
    setStatus(decision === "APPROVE" ? "APPROVED" : "REJECTED");
    setMessage({
      kind: "ok",
      text:
        decision === "APPROVE"
          ? `Published. The contributor now sees ${settings.currency} ${payout} on their dashboard.`
          : "Sent back to the contributor with your note.",
    });
    setNote("");
    router.refresh();
  }

  async function updatePayout() {
    setBusy("payout");
    const cents = Math.round(Number(payout.replace(/[^0-9.]/g, "")) * 100);
    const res = await fetch(`/api/editorial/${article.id}/payout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutCents: cents }),
    });
    setBusy(null);
    setMessage(
      res.ok
        ? { kind: "ok", text: "Payout updated - the writer sees the new figure immediately." }
        : { kind: "err", text: "Could not update the payout." },
    );
    router.refresh();
  }

  return (
    <div className="grid gap-4">
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

      <section className="grid gap-3 rounded-xl border border-line p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Edit the copy
        </h2>

        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          className="w-full border-b border-line pb-2 font-serif text-xl font-bold outline-none focus:border-navy"
        />
        <input
          value={form.dek}
          onChange={(e) => update("dek", e.target.value)}
          placeholder="Standfirst"
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Section</span>
          <select
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="rounded-lg border border-line px-3 py-1.5 outline-none focus:border-navy"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={form.body}
          onChange={(e) => update("body", e.target.value)}
          rows={16}
          className="prose-article w-full rounded-xl border border-line p-4 outline-none focus:border-navy"
        />

        <button
          type="button"
          onClick={() => void saveEdits()}
          disabled={busy !== null}
          className="justify-self-start rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
        >
          {busy === "save" ? "Saving..." : "Save edits"}
        </button>
      </section>

      <section className="grid gap-3 rounded-xl border border-line p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Decision</h2>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Estimated payout ({settings.currency})</span>
          <input
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
            inputMode="decimal"
            className="w-40 rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-navy"
          />
          <span className="text-xs text-ink-soft">
            Suggested from payment settings
            {authorTier === "VERIFIED" ? ` incl. +${settings.verifiedBonusPct}% verified bonus` : ""}
            . The writer sees this figure the moment you approve.
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Note to the contributor</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Required when sending a piece back."
            className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void decide("APPROVE")}
            disabled={busy !== null || status === "APPROVED"}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy === "APPROVE" ? "Publishing..." : "Approve and publish"}
          </button>
          <button
            type="button"
            onClick={() => void decide("REJECT")}
            disabled={busy !== null}
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
          >
            {busy === "REJECT" ? "Sending back..." : "Send back for changes"}
          </button>
          {status === "APPROVED" ? (
            <>
              <button
                type="button"
                onClick={() => void updatePayout()}
                disabled={busy !== null}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-50"
              >
                {busy === "payout" ? "Saving..." : "Update payout only"}
              </button>
              <Link
                href={`/article/${article.slug}`}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
              >
                View live
              </Link>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
