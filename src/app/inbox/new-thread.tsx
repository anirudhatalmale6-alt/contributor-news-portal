"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; name: string; email: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Contributor",
};

/**
 * Starting a conversation. Collapsed by default so the list of threads stays
 * the main thing on the screen.
 */
export function NewThread({
  people,
  canChoosePerson,
}: {
  people: Person[];
  canChoosePerson: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", body: "", toUserId: "" });
  const [query, setQuery] = useState("");

  const matches = query.trim()
    ? people.filter((p) =>
        `${p.name} ${p.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : people;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.subject,
        body: form.body,
        ...(form.toUserId ? { toUserId: form.toUserId } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send that message.");
      return;
    }
    setForm({ subject: "", body: "", toUserId: "" });
    setOpen(false);
    router.push(`/inbox/${data.thread.id}`);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark"
      >
        {canChoosePerson ? "New message" : "Message the newsroom"}
      </button>
    );
  }

  return (
    <form onSubmit={send} className="mt-4 grid gap-3 rounded-xl border border-line p-4">
      {canChoosePerson ? (
        <div className="grid gap-1 text-sm">
          <span className="font-medium">To</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a contributor or colleague by name or email"
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          />
          <select
            value={form.toUserId}
            onChange={(e) => setForm({ ...form, toUserId: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          >
            <option value="">The whole newsroom (every editor can answer)</option>
            {matches.slice(0, 50).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {ROLE_LABEL[p.role] ?? p.role} · {p.email}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Subject</span>
        <input
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          required
          maxLength={120}
          className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Message</span>
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          required
          rows={5}
          maxLength={4000}
          className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
        />
      </label>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Sending..." : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:bg-paper-soft"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
