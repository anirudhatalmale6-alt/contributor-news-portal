"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Request = {
  id: string;
  who: string;
  whoId: string;
  amount: string;
  method: string;
  accountName: string;
  destination: string;
  note: string | null;
  asked: string;
  /** Set when the contributor has changed their payment details since asking. */
  changedSince: string | null;
};

/**
 * The money queue: who has asked to be paid, where to send it, and the two
 * buttons that answer them.
 *
 * The destination shown here is the one copied onto the request when it was
 * made. If the contributor has edited their details since, that is said out
 * loud rather than quietly showing the new ones - sending money to the wrong
 * place is not a mistake you get to undo.
 */
export function PayoutBoard({ requests }: { requests: Request[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function decide(id: string, status: "PAID" | "DECLINED") {
    const note = notes[id]?.trim() ?? "";
    if (status === "DECLINED" && !note) {
      setMessage({ kind: "err", text: "Write a reason before declining - they will see it." });
      return;
    }
    if (
      status === "PAID" &&
      !window.confirm("Mark this as paid? Do this only after the money has actually been sent.")
    ) {
      return;
    }
    setBusy(id);
    setMessage(null);
    const res = await fetch(`/api/payouts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: note || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not record that." });
      return;
    }
    setMessage({
      kind: "ok",
      text: status === "PAID" ? "Marked as paid, and they have been told." : "Declined, with your reason.",
    });
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-ink-soft">
        Nobody is waiting to be paid.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
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

      {requests.map((r) => (
        <section key={r.id} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-serif text-lg font-bold">
              <Link href={`/people/${r.whoId}`} className="hover:underline">
                {r.who}
              </Link>{" "}
              <span className="font-sans text-base font-medium text-ink-soft">asked for</span>{" "}
              {r.amount}
            </p>
            <span className="text-xs text-ink-soft">{r.asked}</span>
          </div>

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-soft">Send by</dt>
            <dd className="font-medium">{r.method}</dd>
            <dt className="text-ink-soft">Account name</dt>
            <dd className="font-medium">{r.accountName}</dd>
            <dt className="text-ink-soft">Send to</dt>
            <dd className="font-medium tabular-nums">{r.destination}</dd>
          </dl>

          {r.changedSince ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Careful: they changed their payment details {r.changedSince}, after asking. Above is
              what they gave at the time. Check with them before sending anything.
            </p>
          ) : null}

          {r.note ? (
            <p className="mt-3 rounded-lg bg-paper-soft px-3 py-2 text-sm">
              <span className="text-ink-soft">They wrote: </span>
              {r.note}
            </p>
          ) : null}

          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-xs text-ink-soft">
              Note back to them (required if you decline)
            </span>
            <input
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              maxLength={500}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              name="mark-paid"
              onClick={() => void decide(r.id, "PAID")}
              disabled={busy === r.id}
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy === r.id ? "Saving..." : "Mark as paid"}
            </button>
            <button
              type="button"
              name="decline-payout"
              onClick={() => void decide(r.id, "DECLINED")}
              disabled={busy === r.id}
              className="rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
