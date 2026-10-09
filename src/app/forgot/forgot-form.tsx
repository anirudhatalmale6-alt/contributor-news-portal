"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Asking for a reset link.
 *
 * The answer is the same whether or not the address has an account, because
 * the reply is also visible to somebody who is guessing at other people's
 * email addresses.
 */
export function ForgotForm({ locale }: { locale: Locale }) {
  const bn = locale === "BN";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? (bn ? "আবার চেষ্টা করুন।" : "Please try again."));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {bn
          ? "ঠিকানাটি যদি আমাদের কাছে থাকে, নতুন পাসওয়ার্ড দেওয়ার লিংক পাঠানো হয়েছে। লিংকটি এক ঘণ্টা কাজ করবে এবং একবারই ব্যবহার করা যাবে। কিছু না পেলে নিউজরুমে জানান।"
          : "If that address is on an account, a link to set a new password is on its way. It works once and lasts an hour. If nothing arrives, tell the newsroom and an editor will send you one."}
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
        <span className="font-medium">{bn ? "ইমেইল" : "Email"}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? (bn ? "পাঠানো হচ্ছে..." : "Sending...") : bn ? "লিংক পাঠান" : "Send me a link"}
      </button>
    </form>
  );
}
