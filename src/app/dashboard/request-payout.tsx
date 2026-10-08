"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Asking to be paid.
 *
 * The figures are worked out on the server and handed down; this only shows
 * them and sends the request. Why the button is unavailable is always spelled
 * out - a greyed-out button with no reason is the thing people write in about.
 */
export function RequestPayout({
  available,
  minimum,
  pending,
  hasDetails,
  canRequest,
}: {
  /** What they can ask for, already formatted with the currency. */
  available: string;
  /** The threshold, formatted the same way. */
  minimum: string;
  /** A request already waiting, if there is one. */
  pending: { amount: string; since: string } | null;
  hasDetails: boolean;
  /** True when they are over the threshold and nothing is in the way. */
  canRequest: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note.trim() || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not send that request." });
      return;
    }
    setOpen(false);
    setNote("");
    setMessage({
      kind: "ok",
      text: "Sent. The desk has it, and you will see a note here when it is paid.",
    });
    router.refresh();
  }

  if (pending) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">
          You have asked for {pending.amount}
        </p>
        <p className="mt-0.5 text-sm text-amber-900">
          Sent {pending.since}. The desk will tell you here when it has been paid. You can ask
          again once this one is answered.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line p-4">
      {message ? (
        <p
          role="status"
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Available to withdraw: {available}</p>
          {/* The rule, in plain words, whether or not they have met it. */}
          <p className="mt-0.5 text-sm text-ink-soft">
            You can request a payout once you have earned at least {minimum}.
            {!hasDetails ? " Add your payment details first." : ""}
          </p>
        </div>

        {open ? null : (
          <button
            type="button"
            name="request-payout"
            onClick={() => (hasDetails ? setOpen(true) : null)}
            disabled={!canRequest}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request payout
          </button>
        )}

        {!hasDetails ? (
          <Link
            href="/dashboard/payout"
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
          >
            Add payment details
          </Link>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 grid gap-2 border-t border-line pt-3">
          <p className="text-sm">
            This asks the desk to send you <span className="font-medium">{available}</span> using
            the payment details on your account.
          </p>
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-ink-soft">Anything the desk should know (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              name="confirm-payout"
              onClick={() => void send()}
              disabled={busy}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? "Sending..." : `Send the request for ${available}`}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
