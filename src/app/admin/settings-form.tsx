"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  currency: string;
  defaultPayout: number;
  verifiedBonusPct: number;
  payoutNote: string;
  minPayoutCents: number;
  requireTranslation: boolean;
};

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    currency: settings.currency,
    defaultPayout: (settings.defaultPayout / 100).toFixed(2),
    verifiedBonusPct: String(settings.verifiedBonusPct),
    payoutNote: settings.payoutNote,
    minPayout: (settings.minPayoutCents / 100).toFixed(2),
  });
  const [requireTranslation, setRequireTranslation] = useState(settings.requireTranslation);
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
        minPayoutCents: Math.round(Number(form.minPayout) * 100),
        requireTranslation,
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Currency</span>
          <input
            value={form.currency}
            maxLength={3}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 uppercase outline-none focus:border-navy"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Default payout</span>
          <input
            value={form.defaultPayout}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, defaultPayout: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-navy"
          />
          <span className="text-xs text-ink-soft">Pre-fills the editor&rsquo;s payout box.</span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Minimum before a payout</span>
          <input
            name="minPayout"
            value={form.minPayout}
            inputMode="decimal"
            onChange={(e) => setForm({ ...form, minPayout: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-navy"
          />
          <span className="text-xs text-ink-soft">
            What a contributor must have earned before they can ask to be paid.
          </span>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Verified bonus %</span>
          <input
            value={form.verifiedBonusPct}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, verifiedBonusPct: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 tabular-nums outline-none focus:border-navy"
          />
          <span className="text-xs text-ink-soft">Suggested uplift for Verified writers.</span>
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Note shown on contributor dashboards</span>
        <input
          value={form.payoutNote}
          onChange={(e) => setForm({ ...form, payoutNote: e.target.value })}
          className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-line bg-paper-soft p-3 text-sm">
        <input
          type="checkbox"
          checked={requireTranslation}
          onChange={(e) => setRequireTranslation(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Require a translation before publishing</span>
          <span className="mt-0.5 block text-xs text-ink-soft">
            On: an editor cannot approve a piece until the Bangla or English version exists, so both
            sides of the site always carry the same stories.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
