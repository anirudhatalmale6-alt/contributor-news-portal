"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";

type Entry = {
  id: string;
  amountCents: number;
  reason: string;
  createdAt: string;
  createdBy: { name: string } | null;
};

type Totals = { articleCents: number; adjustmentCents: number; totalCents: number };

/**
 * Bonuses and deductions on top of what the articles earned.
 *
 * The article payouts themselves are left alone: they are what an editor agreed
 * for a piece. Everything else is an entry here, with a reason attached.
 */
export function EarningsPanel({
  userId,
  name,
  currency,
  initialTotals,
  initialEntries,
}: {
  userId: string;
  name: string;
  currency: string;
  initialTotals: Totals;
  initialEntries: Entry[];
}) {
  const router = useRouter();
  const [totals, setTotals] = useState(initialTotals);
  const [entries, setEntries] = useState(initialEntries);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function refresh() {
    const res = await fetch(`/api/admin/users/${userId}/earnings`);
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
    setTotals(data.totals);
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const major = Number(amount);
    if (!Number.isFinite(major) || major <= 0) {
      setMessage({ kind: "err", text: "Enter an amount greater than zero." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/earnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: Math.round(major * 100) * sign, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save that." });
      return;
    }
    setAmount("");
    setReason("");
    setMessage({
      kind: "ok",
      text: sign > 0 ? "Bonus added to their total." : "Deduction taken off their total.",
    });
    await refresh();
  }

  async function remove(entryId: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/earnings/${entryId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not remove that entry." });
      return;
    }
    setMessage({ kind: "ok", text: "Entry removed." });
    await refresh();
  }

  const field = "rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

  return (
    <section className="rounded-xl border border-line p-5">
      <h2 className="font-serif text-lg font-bold">Earnings</h2>
      <p className="mt-1 text-sm text-ink-soft">
        What {name} is owed. Article payouts come from the editor who published each
        piece; everything below is a correction you make here.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-paper-soft p-3">
          <dt className="text-xs text-ink-soft">From published articles</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">
            {money(totals.articleCents, currency)}
          </dd>
        </div>
        <div className="rounded-lg border border-line bg-paper-soft p-3">
          <dt className="text-xs text-ink-soft">Bonuses and deductions</dt>
          <dd
            className={`mt-0.5 font-semibold tabular-nums ${
              totals.adjustmentCents < 0 ? "text-rose-700" : ""
            }`}
          >
            {totals.adjustmentCents > 0 ? "+" : ""}
            {money(totals.adjustmentCents, currency)}
          </dd>
        </div>
        <div className="rounded-lg border border-navy bg-navy/5 p-3">
          <dt className="text-xs text-ink-soft">Total owed</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-navy">
            {money(totals.totalCents, currency)}
          </dd>
        </div>
      </dl>

      <form onSubmit={add} className="mt-5 grid gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <span className="text-sm font-medium">Add or take off</span>
            <div className="flex overflow-hidden rounded-lg border border-line">
              <button
                type="button"
                onClick={() => setSign(1)}
                className={`px-3 py-2 text-sm font-medium ${
                  sign > 0 ? "bg-emerald-600 text-white" : "text-ink-soft hover:bg-paper-soft"
                }`}
              >
                Bonus +
              </button>
              <button
                type="button"
                onClick={() => setSign(-1)}
                className={`px-3 py-2 text-sm font-medium ${
                  sign < 0 ? "bg-rose-700 text-white" : "text-ink-soft hover:bg-paper-soft"
                }`}
              >
                Deduct -
              </button>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-medium">Amount ({currency})</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="500"
              className={`${field} w-36 tabular-nums`}
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Reason</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={300}
            placeholder={
              sign > 0 ? "Bonus for the flood investigation" : "Payment void: fabricated report"
            }
            className={field}
          />
          <span className="text-xs text-ink-soft">
            Saved with the entry. Whoever reads this ledger later needs to know why the total moved.
          </span>
        </label>

        {message ? (
          <p className={`text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="justify-self-start rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Saving..." : sign > 0 ? "Add bonus" : "Take off earnings"}
        </button>
      </form>

      {entries.length > 0 ? (
        <ul className="mt-5 grid gap-2 border-t border-line pt-4">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span
                className={`w-28 shrink-0 font-semibold tabular-nums ${
                  e.amountCents < 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {e.amountCents > 0 ? "+" : ""}
                {money(e.amountCents, currency)}
              </span>
              <span className="min-w-0 flex-1">{e.reason}</span>
              <span className="text-xs text-ink-soft">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(e.createdAt))}
                {e.createdBy ? ` · ${e.createdBy.name}` : ""}
              </span>
              <button
                type="button"
                onClick={() => void remove(e.id)}
                disabled={busy}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
