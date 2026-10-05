"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  currency: string;
  defaultPayout: number;
  verifiedBonusPct: number;
  payoutNote: string;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    currency: settings.currency,
    defaultPayout: (settings.defaultPayout / 100).toFixed(2),
    verifiedBonusPct: String(settings.verifiedBonusPct),
    payoutNote: settings.payoutNote,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency: form.currency.toUpperCase(),
        defaultPayout: Math.round(Number(form.defaultPayout) * 100),
        verifiedBonusPct: Number(form.verifiedBonusPct),
        payoutNote: form.payoutNote,
      }),
    });
    setBusy(false);
    setSaved(res.ok);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Payment settings
        </h2>
        {saved ? <span className="text-xs text-emerald-700">Saved</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Currency</span>
          <input
            value={form.currency}
            maxLength={3}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 uppercase outline-none focus:border-ink"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Default payout</span>
          <input
            value={form.defaultPayout}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, defaultPayout: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-ink"
          />
          <span className="text-xs text-ink-soft">Pre-fills the editor&rsquo;s payout box.</span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Verified bonus %</span>
          <input
            value={form.verifiedBonusPct}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, verifiedBonusPct: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-ink"
          />
          <span className="text-xs text-ink-soft">Suggested uplift for Verified writers.</span>
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Note shown on contributor dashboards</span>
        <input
          value={form.payoutNote}
          onChange={(e) => setForm({ ...form, payoutNote: e.target.value })}
          className="rounded-lg border border-line px-3 py-2 outline-none focus:border-ink"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
