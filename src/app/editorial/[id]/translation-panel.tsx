"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormatToolbar } from "@/components/format-toolbar";

type Locale = "EN" | "BN";

const NAME: Record<Locale, string> = { EN: "English", BN: "বাংলা (Bangla)" };

/**
 * The editor's translation desk: original on the left, the other language on
 * the right. Saving is its own action, separate from approving, so an editor
 * can translate in stages.
 */
export function TranslationPanel({
  articleId,
  sourceLocale,
  source,
  existing,
  aiReady,
}: {
  articleId: string;
  sourceLocale: Locale;
  source: { title: string; dek: string; body: string };
  /** Whether the site has a translation key configured. No key, no button. */
  aiReady: boolean;
  existing: {
    title: string;
    dek: string;
    body: string;
    translator: string | null;
    byAuthor: boolean;
  } | null;
}) {
  const router = useRouter();
  const target: Locale = sourceLocale === "EN" ? "BN" : "EN";
  const [form, setForm] = useState({
    title: existing?.title ?? "",
    dek: existing?.dek ?? "",
    body: existing?.body ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saved, setSaved] = useState(Boolean(existing));
  const [drafting, setDrafting] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Fills the boxes with a machine translation. It saves nothing: the editor
   * reads it, changes what they want, and presses Save themselves.
   */
  async function draft() {
    if (
      (form.title.trim() || form.body.trim()) &&
      !window.confirm("This replaces what is in the boxes below. Continue?")
    ) {
      return;
    }
    setDrafting(true);
    setMessage(null);
    const res = await fetch(`/api/editorial/${articleId}/translation/draft`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      draft?: { title: string; dek: string; body: string };
      error?: string;
    };
    setDrafting(false);
    if (!res.ok || !data.draft) {
      setMessage({ kind: "err", text: data.error ?? "Could not draft the translation." });
      return;
    }
    setForm(data.draft);
    setMessage({
      kind: "ok",
      text: "Draft ready. Read it, change anything you want, then press Save - nothing is saved or published until you do.",
    });
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/editorial/${articleId}/translation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: target, ...form }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save the translation." });
      return;
    }
    setSaved(true);
    setMessage({ kind: "ok", text: `${NAME[target]} version saved.` });
    router.refresh();
  }

  const lang = target === "BN" ? "bn" : "en";

  return (
    <section id="translation" className="grid gap-3 rounded-xl border border-line p-4 scroll-mt-20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          {saved ? `${NAME[target]} version` : `Write the ${NAME[target]} version`}
        </h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            saved
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {saved
            ? existing?.byAuthor
              ? "Supplied by the contributor"
              : "Translation ready"
            : "Not translated yet"}
        </span>
      </div>

      <p className="text-xs text-ink-soft">
        The contributor wrote this in {NAME[sourceLocale]}. Readers on the{" "}
        {target === "BN" ? "Bangla" : "English"} side of the site see what you write here, and a
        piece cannot be published until this exists.
        {existing?.translator
          ? existing.byAuthor
            ? ` The contributor wrote this version themselves - check it before publishing.`
            : ` Last saved by ${existing.translator}.`
          : ""}
      </p>

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

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Original ({NAME[sourceLocale]})
          </p>
          <div
            lang={sourceLocale === "BN" ? "bn" : "en"}
            className="rounded-lg border border-line bg-paper-soft p-3"
          >
            <p className="font-serif text-base font-bold">{source.title}</p>
            {source.dek ? <p className="mt-1 text-sm text-ink-soft">{source.dek}</p> : null}
            <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {source.body}
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {NAME[target]} version
          </p>
          <input
            value={form.title}
            lang={lang}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={target === "BN" ? "শিরোনাম" : "Headline"}
            className="w-full rounded-lg border border-line px-3 py-2 font-serif text-base font-bold outline-none focus:border-navy"
          />
          <input
            value={form.dek}
            lang={lang}
            onChange={(e) => setForm({ ...form, dek: e.target.value })}
            placeholder={target === "BN" ? "সংক্ষিপ্ত বিবরণ" : "Standfirst"}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <div>
            {/* The same bold, italics and subtitles the original was written
                with - a translation that cannot carry them is not a translation. */}
            <FormatToolbar
              textareaRef={bodyRef}
              value={form.body}
              onChange={(next) => setForm({ ...form, body: next })}
            />
            <textarea
              ref={bodyRef}
              value={form.body}
              lang={lang}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={12}
              placeholder={target === "BN" ? "অনুবাদ এখানে লিখুন" : "Write the translation here"}
              className="prose-article w-full rounded-b-lg border border-line p-3 outline-none focus:border-navy"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || drafting || !form.title.trim() || !form.body.trim()}
          className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {busy ? "Saving..." : saved ? "Update translation" : "Save translation"}
        </button>

        {aiReady ? (
          <>
            <button
              type="button"
              name="draft-translation"
              onClick={() => void draft()}
              disabled={busy || drafting}
              className="rounded-full border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-50"
            >
              {drafting ? "Translating..." : `Draft the ${NAME[target]} version with AI`}
            </button>
            <span className="text-xs text-ink-soft">
              Writes a first draft into the boxes above. You still read it and press Save.
            </span>
          </>
        ) : null}
      </div>
    </section>
  );
}
