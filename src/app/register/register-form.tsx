"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the account.");
      setBusy(false);
      return;
    }

    // Straight into the writing desk - no second login step.
    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Full name</span>
        <input
          required
          minLength={2}
          autoComplete="name"
          value={form.name}
          onChange={set("name")}
          className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-navy"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
          className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-navy"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
          className="rounded-lg border border-line px-3 py-2.5 outline-none focus:border-navy"
        />
        <span className="text-xs text-ink-soft">At least 8 characters.</span>
      </label>

      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Creating account..." : "Create my account"}
      </button>
    </form>
  );
}
