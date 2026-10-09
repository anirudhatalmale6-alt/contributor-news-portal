"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function ResetForm({ token, locale }: { token: string; locale: Locale }) {
  const bn = locale === "BN";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Caught here so a typo is not stored as the new password.
    if (password !== again) {
      setError(bn ? "দুটি পাসওয়ার্ড এক নয়।" : "The two passwords are not the same.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? (bn ? "আবার চেষ্টা করুন।" : "Please try again."));
      return;
    }
    setDone(true);
    setTimeout(() => router.push(bn ? "/login?lang=bn" : "/login"), 1800);
  }

  if (done) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {bn
          ? "হয়ে গেছে। নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন..."
          : "Done. Taking you to the sign-in page..."}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      ) : null}
      <label className="grid gap-1 text-sm">
        <span className="font-medium">{bn ? "নতুন পাসওয়ার্ড" : "New password"}</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
        <span className="text-xs text-ink-soft">
          {bn ? "অন্তত ৮টি অক্ষর।" : "At least 8 characters."}
        </span>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">{bn ? "আবার লিখুন" : "Type it again"}</span>
        <input
          type="password"
          name="again"
          required
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? (bn ? "সংরক্ষণ হচ্ছে..." : "Saving...") : bn ? "পাসওয়ার্ড সংরক্ষণ করুন" : "Save the new password"}
      </button>
    </form>
  );
}
