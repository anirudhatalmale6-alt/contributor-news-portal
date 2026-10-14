"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Summary = {
  inSettings: { provider: "OPENAI" | "ANTHROPIC"; hint: string; readable: boolean } | null;
  onServer: "OPENAI" | "ANTHROPIC" | null;
};

const LABEL = { OPENAI: "ChatGPT (OpenAI)", ANTHROPIC: "Claude (Anthropic)" } as const;
const WHERE = {
  OPENAI: "platform.openai.com, under API keys",
  ANTHROPIC: "console.anthropic.com, under API keys",
} as const;

/**
 * The owner's AI key. Write-only: what is saved never comes back to the
 * browser, only which service it is for and its last four characters.
 */
export function AiKeyForm({ summary }: { summary: Summary }) {
  const router = useRouter();
  const [provider, setProvider] = useState<"OPENAI" | "ANTHROPIC">(
    summary.inSettings?.provider ?? "OPENAI",
  );
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/ai-key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save the key." });
      return;
    }
    setKey("");
    setMessage({ kind: "ok", text: data.message });
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/admin/ai-key", { method: "DELETE" });
    setBusy(false);
    setMessage({ kind: "ok", text: "Key removed. The AI buttons are switched off." });
    router.refresh();
  }

  const current = summary.inSettings;

  return (
    <section id="ai-key" className="mb-6 grid gap-3 rounded-xl border border-line p-4">
      <div>
        <h2 className="font-serif text-lg font-bold">AI translation</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Drafts the English version of a Bangla piece (and the other way round) for an editor to
          check and save. Uses your own key, so the cost goes to your account with the service,
          not through this site. A ChatGPT Plus subscription does not include this: the key comes
          from {WHERE[provider]}, with a little prepaid credit on it.
        </p>
      </div>

      {current ? (
        <p className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">
          {current.readable ? (
            <>
              In use: <span className="font-medium">{LABEL[current.provider]}</span>, key ending in{" "}
              <span className="font-mono">{current.hint}</span>.
            </>
          ) : (
            <>
              A key is stored but can no longer be read (the server&apos;s secret has changed). Paste
              it in again.
            </>
          )}
        </p>
      ) : summary.onServer ? (
        <p className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">
          In use: {LABEL[summary.onServer]}, with a key set on the server itself. A key added here
          takes its place.
        </p>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Switched off: no key yet. The translate button appears once a key is added.
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

      <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Service</span>
          <select
            name="aiProvider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "OPENAI" | "ANTHROPIC")}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          >
            <option value="OPENAI">{LABEL.OPENAI}</option>
            <option value="ANTHROPIC">{LABEL.ANTHROPIC}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{current ? "Replace the key" : "Key"}</span>
          <input
            name="aiKey"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={provider === "OPENAI" ? "sk-..." : "sk-ant-..."}
            className="rounded-lg border border-line px-3 py-2 font-mono text-sm outline-none focus:border-navy"
          />
        </label>
        <button
          type="button"
          name="save-ai-key"
          onClick={() => void save()}
          disabled={busy || key.trim().length < 20}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {busy ? "Checking..." : "Check and save"}
        </button>
      </div>

      {current ? (
        <button
          type="button"
          name="remove-ai-key"
          onClick={() => void remove()}
          disabled={busy}
          className="justify-self-start text-xs font-medium text-rose-800 hover:underline"
        >
          Remove the key
        </button>
      ) : null}
    </section>
  );
}
