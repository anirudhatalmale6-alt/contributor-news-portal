"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReplyForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/inbox/${threadId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send that reply.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={send} className="mt-5 grid gap-2 rounded-xl border border-line p-4">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Reply</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Write your reply"
          className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="justify-self-start rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {busy ? "Sending..." : "Send reply"}
      </button>
    </form>
  );
}
