"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Suspend or restore an account.
 *
 * Suspending stops them signing in and stops anything they have open from
 * saving; it deliberately does not unpublish work the desk already approved.
 * A reason is required, and it is kept with the record.
 */
export function SuspendPanel({
  userId,
  name,
  suspendedAt,
  reason,
  by,
}: {
  userId: string;
  name: string;
  suspendedAt: string | null;
  reason: string | null;
  by: string | null;
}) {
  const router = useRouter();
  const [suspended, setSuspended] = useState(Boolean(suspendedAt));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: next, reason: text }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not change that.");
      return;
    }
    setSuspended(next);
    setText("");
    router.refresh();
  }

  if (suspended) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-sm font-medium text-rose-900">{name} is suspended</h2>
        <p className="mt-1 text-sm text-rose-900">
          They cannot sign in or write. Articles already published stay published.
        </p>
        {reason ? (
          <p className="mt-2 text-sm text-rose-900">
            <span className="font-medium">Reason:</span> {reason}
            {by ? ` (${by})` : ""}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-rose-800">{error}</p> : null}
        <button
          type="button"
          onClick={() => void set(false)}
          disabled={busy}
          className="mt-4 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Working..." : "Lift the suspension"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line p-5">
      <h2 className="text-sm font-medium">Suspend this account</h2>
      <p className="mt-1 text-sm text-ink-soft">
        They will not be able to sign in or submit anything. Their published articles stay where
        they are. You can lift it again at any time.
      </p>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}

      <label className="mt-3 grid gap-1 text-sm">
        <span className="font-medium">Reason</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Why this account is being suspended"
          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy"
        />
      </label>

      <button
        type="button"
        onClick={() => void set(true)}
        disabled={busy || !text.trim()}
        className="mt-3 rounded-full border border-rose-300 px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
      >
        {busy ? "Working..." : "Suspend"}
      </button>
    </section>
  );
}
