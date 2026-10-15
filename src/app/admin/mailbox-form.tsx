"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Summary = {
  host: string;
  port: number;
  user: string;
  fromName: string;
  saved: boolean;
  readable: boolean;
  onServer: boolean;
};

/**
 * The mailbox the site sends from. With one set, a contributor who forgets
 * their password gets the reset link in their own inbox; without one, the link
 * goes to the admins' Updates to pass on by hand.
 */
export function MailboxForm({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [form, setForm] = useState({
    host: summary.host,
    port: String(summary.port),
    user: summary.user,
    pass: "",
    fromName: summary.fromName,
  });
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const field = "rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

  async function call(kind: "save" | "test" | "remove") {
    setBusy(kind);
    setMessage(null);
    const res = await fetch(kind === "test" ? "/api/admin/mailbox/test" : "/api/admin/mailbox", {
      method: kind === "save" ? "PUT" : kind === "test" ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: kind === "save" ? JSON.stringify({ ...form, port: Number(form.port) }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "That did not work." });
      return;
    }
    if (kind === "save") setForm({ ...form, pass: "" });
    setMessage({
      kind: "ok",
      text: data.message ?? "Mailbox removed. Reset links go to the admins' Updates again.",
    });
    router.refresh();
  }

  return (
    <section id="mailbox" className="mb-6 grid gap-3 rounded-xl border border-line p-4">
      <div>
        <h2 className="font-serif text-lg font-bold">Email sending</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The mailbox the site sends from, for password reset links. Your domain&apos;s email is
          with IONOS, so create a mailbox there (for example no-reply@thedocument.net) and enter
          its address and password here. The password is stored sealed and never shown again.
        </p>
      </div>

      {summary.saved && summary.readable ? (
        <p className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">
          Sending from <span className="font-medium">{summary.user}</span>. Reset links go straight
          to the contributor.
        </p>
      ) : summary.onServer ? (
        <p className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">
          Sending with a mailbox set on the server itself. One saved here takes its place.
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No mailbox yet, so reset links appear in the admins&apos; Updates for you to pass on.
        </p>
      )}

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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Mailbox address</span>
          <input
            name="smtpUser"
            type="email"
            value={form.user}
            onChange={(e) => setForm({ ...form, user: e.target.value })}
            placeholder="no-reply@thedocument.net"
            className={field}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{summary.saved ? "Mailbox password (to change it)" : "Mailbox password"}</span>
          <input
            name="smtpPass"
            type="password"
            autoComplete="new-password"
            value={form.pass}
            onChange={(e) => setForm({ ...form, pass: e.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name the email comes from</span>
          <input
            name="smtpFromName"
            value={form.fromName}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            className={field}
          />
        </label>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Mail server</span>
            <input
              name="smtpHost"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              className={field}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Port</span>
            <input
              name="smtpPort"
              inputMode="numeric"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: e.target.value.replace(/[^0-9]/g, "") })}
              className={field}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          name="save-mailbox"
          onClick={() => void call("save")}
          disabled={busy !== null || !form.user || !form.pass}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {busy === "save" ? "Checking..." : "Check and save"}
        </button>
        {summary.saved || summary.onServer ? (
          <button
            type="button"
            name="test-mailbox"
            onClick={() => void call("test")}
            disabled={busy !== null}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-50"
          >
            {busy === "test" ? "Sending..." : "Send me a test email"}
          </button>
        ) : null}
        {summary.saved ? (
          <button
            type="button"
            name="remove-mailbox"
            onClick={() => void call("remove")}
            disabled={busy !== null}
            className="text-xs font-medium text-rose-800 hover:underline"
          >
            Remove the mailbox
          </button>
        ) : null}
      </div>
    </section>
  );
}
