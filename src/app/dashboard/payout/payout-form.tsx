"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYOUT_METHODS, methodKind } from "@/lib/payout";

type Form = {
  method: string;
  accountName: string;
  walletNumber: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  routingNumber: string;
  email: string;
  country: string;
  note: string;
};

const EMPTY: Form = {
  method: "BKASH",
  accountName: "",
  walletNumber: "",
  bankName: "",
  branch: "",
  accountNumber: "",
  routingNumber: "",
  email: "",
  country: "Bangladesh",
  note: "",
};

export function PayoutForm({
  initial,
  updatedAt,
}: {
  initial: Form | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(initial ?? EMPTY);
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const kind = methodKind(form.method);
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const error = (field: string) => issues[field]?.[0];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setIssues({});
    setMessage(null);

    const res = await fetch("/api/profile/payout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setIssues(data.issues ?? {});
      setMessage({ kind: "err", text: data.error ?? "Could not save the details." });
      return;
    }
    setMessage({ kind: "ok", text: "Payment details saved." });
    router.refresh();
  }

  const field = "rounded-lg border border-line px-3 py-2.5 outline-none focus:border-navy";

  return (
    <form onSubmit={save} className="grid gap-4 rounded-xl border border-line p-5">
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

      <label className="grid gap-1 text-sm">
        <span className="font-medium">How would you like to be paid?</span>
        <select value={form.method} onChange={set("method")} className={field}>
          {PAYOUT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Account holder name</span>
        <input
          value={form.accountName}
          onChange={set("accountName")}
          placeholder="Exactly as it appears on the account"
          className={field}
        />
        {error("accountName") ? (
          <span className="text-xs text-rose-700">{error("accountName")}</span>
        ) : null}
      </label>

      {kind === "wallet" ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">
            {PAYOUT_METHODS.find((m) => m.value === form.method)?.label} number
          </span>
          <input
            value={form.walletNumber}
            onChange={set("walletNumber")}
            inputMode="numeric"
            placeholder="01XXXXXXXXX"
            className={field}
          />
          <span className="text-xs text-ink-soft">
            Personal number, 11 digits. Payouts go to this wallet.
          </span>
          {error("walletNumber") ? (
            <span className="text-xs text-rose-700">{error("walletNumber")}</span>
          ) : null}
        </label>
      ) : null}

      {kind === "bank" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Bank name</span>
            <input value={form.bankName} onChange={set("bankName")} className={field} />
            {error("bankName") ? (
              <span className="text-xs text-rose-700">{error("bankName")}</span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Branch</span>
            <input value={form.branch} onChange={set("branch")} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Account number</span>
            <input
              value={form.accountNumber}
              onChange={set("accountNumber")}
              inputMode="numeric"
              className={field}
            />
            {error("accountNumber") ? (
              <span className="text-xs text-rose-700">{error("accountNumber")}</span>
            ) : null}
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Routing number</span>
            <input
              value={form.routingNumber}
              onChange={set("routingNumber")}
              inputMode="numeric"
              className={field}
            />
          </label>
        </div>
      ) : null}

      {kind === "email" ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">
            {form.method === "PAYPAL" ? "PayPal email" : "Wise email"}
          </span>
          <input value={form.email} onChange={set("email")} type="email" className={field} />
          {error("email") ? <span className="text-xs text-rose-700">{error("email")}</span> : null}
        </label>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Country</span>
          <input value={form.country} onChange={set("country")} className={field} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Note for the accounts desk (optional)</span>
          <input
            value={form.note}
            onChange={set("note")}
            placeholder="Anything they should know"
            className={field}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Saving..." : initial ? "Update payment details" : "Save payment details"}
        </button>
        {updatedAt ? (
          <span className="text-xs text-ink-soft">
            Last updated {new Date(updatedAt).toLocaleDateString("en-GB")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
