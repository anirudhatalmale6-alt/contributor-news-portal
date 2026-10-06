"use client";

import { useState } from "react";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const field = "rounded-lg border border-line px-3 py-2.5 outline-none focus:border-navy";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (form.newPassword !== form.confirm) {
      setMessage({ kind: "err", text: "The two new passwords do not match." });
      return;
    }

    setBusy(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(hasPassword ? { currentPassword: form.currentPassword } : {}),
        newPassword: form.newPassword,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not change the password." });
      return;
    }
    setForm({ currentPassword: "", newPassword: "", confirm: "" });
    setMessage({ kind: "ok", text: "Password changed. It applies the next time you sign in." });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border border-line p-5">
      <div>
        <h2 className="text-sm font-medium">
          {hasPassword ? "Change your password" : "Set a password"}
        </h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          {hasPassword
            ? "Do this as soon as anyone else has known your password."
            : "Your account signs in through a social provider. Setting a password lets you sign in with email too."}
        </p>
      </div>

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

      {hasPassword ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            className={field}
          />
        </label>
      ) : null}

      <label className="grid gap-1 text-sm">
        <span className="font-medium">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          className={field}
        />
        <span className="text-xs text-ink-soft">At least 8 characters.</span>
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Repeat the new password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          className={field}
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}
