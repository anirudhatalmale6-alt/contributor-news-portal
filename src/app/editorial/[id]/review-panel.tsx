"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES } from "@/lib/i18n";
import { FormatToolbar } from "@/components/format-toolbar";

/** The front-page positions, in the order they read down the page. */
const SLOT_LABEL: Record<string, string> = {
  LEAD: "Main headline",
  STRIP: "Beside the masthead",
  LEFT: "Left column",
  MIDDLE: "Under the headline",
  RIGHT: "Right column",
};

type MediaItem = { id: string; kind: string; url: string; caption: string | null };

type ArticleState = {
  id: string;
  title: string;
  dek: string;
  body: string;
  category: string;
  status: string;
  slug: string;
  /** Which half of the site this piece lives on, so "View live" goes somewhere real. */
  language: string;
  coverImage: string | null;
  homeSlot: string | null;
  bylineName: string;
  /** Whose account filed it, shown as the default byline. */
  authorName: string;
  payoutCents: number;
  media: MediaItem[];
};


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
    bylineName: article.bylineName,
  });
  const [payout, setPayout] = useState((settings.suggestedCents / 100).toFixed(2));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(article.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [slot, setSlot] = useState(article.homeSlot ?? "");

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
      // Show what the server actually objected to. "Could not save the edits"
      // on its own gave an editor nothing to act on.
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setMessage({
        kind: "err",
        text:
          data.error ??
          (res.status === 401 || res.status === 403
            ? "Your session has expired. Sign in again and the text below is still here."
            : `Could not save the edits (error ${res.status}).`),
      });
      return;
    }
    setMessage({
      kind: "ok",
      text:
        status === "APPROVED"
          ? "Updated. The live article now shows these changes."
          : "Edits saved.",
    });
    router.refresh();
  }

  /** Where this piece actually sits for a reader. */
  const liveHref = article.language === "BN" ? `/article/${article.slug}` : `/en/article/${article.slug}`;

  async function decide(decision: "APPROVE" | "REJECT") {
    setBusy(decision);
    setMessage(null);

    // Always persist the editor's wording changes before the decision lands -
    // and stop if they would not save, rather than publishing the old copy.
    const saved = await fetch(`/api/editorial/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!saved.ok) {
      const data = (await saved.json().catch(() => ({}))) as { error?: string };
      setBusy(null);
      setMessage({
        kind: "err",
        text: `${data.error ?? `Could not save the edits (error ${saved.status})`}. Nothing was published.`,
      });
      return;
    }

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
    // A place on the front page can only be given to something published, so it
    // is applied after the decision, not with it.
    if (decision === "APPROVE" && slot) {
      await fetch(`/api/editorial/${article.id}/home-slot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeSlot: slot }),
      });
    }

    setStatus(decision === "APPROVE" ? "APPROVED" : "REJECTED");
    setMessage({
      kind: "ok",
      text:
        decision === "APPROVE"
          ? `Published${
              slot ? ` in ${SLOT_LABEL[slot] ?? slot}` : ""
            }. The contributor now sees ${settings.currency} ${payout} on their dashboard.`
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
          lang={article.language === "BN" ? "bn" : "en"}
          className="w-full border-b border-line pb-2 font-serif text-xl font-bold outline-none focus:border-navy"
        />
        <input
          value={form.dek}
          onChange={(e) => update("dek", e.target.value)}
          lang={article.language === "BN" ? "bn" : "en"}
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
        <div>
          <FormatToolbar
            textareaRef={bodyRef}
            value={form.body}
            onChange={(next) => update("body", next)}
          />
          <textarea
            ref={bodyRef}
            value={form.body}
            onChange={(e) => update("body", e.target.value)}
            lang={article.language === "BN" ? "bn" : "en"}
            rows={16}
            className="prose-article w-full rounded-b-xl border border-line p-4 outline-none focus:border-navy"
          />
        </div>

        <button
          type="button"
          onClick={() => void saveEdits()}
          disabled={busy !== null}
          className="justify-self-start rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
        >
          {busy === "save"
            ? "Saving..."
            : status === "APPROVED"
              ? "Save and update the live article"
              : "Save edits"}
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
          <span className="font-medium">Set a contributor name for this article:</span>
          <input
            name="bylineName"
            value={form.bylineName}
            onChange={(e) => update("bylineName", e.target.value)}
            placeholder={`Leave empty to publish under ${article.authorName}`}
            maxLength={120}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy sm:w-72"
          />
          <span className="text-xs text-ink-soft">
            Readers see this name instead. Saved with the copy, above.
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Where it goes on the front page</span>
          <select
            name="homeSlot"
            value={slot}
            onChange={(e) => {
              setSlot(e.target.value);
              // Already live? Move it straight away rather than making the
              // editor re-publish to apply a placement.
              if (status === "APPROVED") {
                void fetch(`/api/editorial/${article.id}/home-slot`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ homeSlot: e.target.value || null }),
                }).then(() => {
                  setMessage({
                    kind: "ok",
                    text: e.target.value
                      ? `Moved to ${SLOT_LABEL[e.target.value]} on the front page.`
                      : "Taken off its fixed place. The front page will choose for itself.",
                  });
                  router.refresh();
                });
              }
            }}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy sm:w-72"
          >
            <option value="">Let the front page decide</option>
            {Object.entries(SLOT_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-soft">
            Arrange every position at once on the{" "}
            <Link href="/editorial/front-page" className="underline hover:text-ink">
              Front page
            </Link>{" "}
            screen.
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
                href={liveHref}
                target="_blank"
                rel="noreferrer"
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
