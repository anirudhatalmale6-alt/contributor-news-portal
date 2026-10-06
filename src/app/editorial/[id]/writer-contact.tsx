"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The writer's number for this submission, plus a one-click way to open an
 * internal thread about the piece. Staff only - this component is never
 * rendered on a public page.
 */
export function WriterContact({
  articleId,
  authorId,
  authorName,
  phone,
  whatsapp,
}: {
  articleId: string;
  authorId: string;
  authorName: string;
  phone: string | null;
  whatsapp: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wa = (whatsapp ?? phone)?.replace(/^0/, "88");

  async function openThread() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "About your submission",
        body: `Hello ${authorName}, a question about your piece before we publish it:`,
        toUserId: authorId,
        articleId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start that conversation.");
      return;
    }
    router.push(`/inbox/${data.thread.id}`);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-paper-soft px-4 py-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
        Reach the writer
      </span>

      {phone ? (
        <a href={`tel:${phone}`} className="font-medium tabular-nums hover:underline">
          {phone}
        </a>
      ) : (
        <span className="text-ink-soft">no number on file</span>
      )}

      {wa ? (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-800 hover:underline"
        >
          WhatsApp
        </a>
      ) : null}

      <button
        type="button"
        onClick={() => void openThread()}
        disabled={busy}
        className="rounded-full border border-navy px-3 py-1 text-xs font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-60"
      >
        {busy ? "Opening..." : "Message in the inbox"}
      </button>

      <span className="text-xs text-ink-soft">Newsroom only, never shown to readers.</span>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </div>
  );
}
