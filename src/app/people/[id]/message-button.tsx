"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Start a conversation with the person whose page this is.
 *
 * Opens straight into the thread rather than asking for a subject first: the
 * newsroom wants to say something now, and the subject is almost always the
 * person's name anyway.
 */
export function MessageButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: `A message for ${name}`,
        body: `Hello ${name},`,
        toUserId: userId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not start that conversation.");
      return;
    }
    router.push(`/inbox/${data.thread.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-2">
          <path d="M4 5h16v12H8l-4 3V5z" strokeLinejoin="round" />
        </svg>
        {busy ? "Opening..." : "Send a message"}
      </button>
      {error ? <span className="text-sm text-rose-700">{error}</span> : null}
    </>
  );
}
