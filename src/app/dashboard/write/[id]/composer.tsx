"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormatToolbar } from "@/components/format-toolbar";
import { CATEGORIES } from "@/lib/i18n";
import Link from "next/link";
import { StatusPill } from "@/components/ui";

type MediaItem = { id: string; kind: string; url: string; caption: string | null };

type ArticleState = {
  id: string;
  title: string;
  dek: string;
  body: string;
  category: string;
  bylineName: string;
  language: "EN" | "BN";
  status: string;
  coverImage: string | null;
  slug: string;
  media: MediaItem[];
  /** The desk writes for itself: no contact number, no witness box. */
  isStaff: boolean;
  /** Whose account this is, shown as the default byline. */
  authorName: string;
  contactPhone: string;
  contactWhatsapp: string;
  witnesses: string;
};


export function Composer({
  article,
  lastNote,
  secondVersion,
  labels,
}: {
  article: ArticleState;
  lastNote: { action: string; note: string; editor: string } | null;
  /** The other-language version, if one already exists for this piece. */
  secondVersion: { title: string; dek: string; body: string; byEditor: boolean } | null;
  /** The owner's wording for this screen, in both languages. A writer working
      in Bangla gets a Bangla form; switching the language switches the form. */
  labels: Record<"EN" | "BN", Record<string, string>>;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: article.title,
    dek: article.dek,
    body: article.body,
    category: article.category,
    bylineName: article.bylineName,
    language: article.language,
  });
  const [status, setStatus] = useState(article.status);
  const [media, setMedia] = useState<MediaItem[]>(article.media);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [secondKey, setSecondKey] = useState(0);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [contact, setContact] = useState({
    phone: article.contactPhone,
    whatsapp: article.contactWhatsapp,
  });
  const [witnesses, setWitnesses] = useState(article.witnesses);
  const isStaff = article.isStaff;
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  const locked = status === "SUBMITTED" || status === "APPROVED";
  /** A label in the language this piece is being written in. */
  const w = (key: string) => labels[form.language][key] ?? key;

  const save = useCallback(
    async (silent = false) => {
      if (locked) return;
      if (!silent) setSaveState("saving");
      const res = await fetch(`/api/drafts/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      dirty.current = false;
      setSaveState("saved");
      if (!silent) setMessage(w("compose.saved"));
      if (status === "REJECTED") setStatus("DRAFT");
    },
    [article.id, form, locked, status],
  );

  // Autosave two seconds after the writer stops typing.
  useEffect(() => {
    if (locked) return;
    if (!dirty.current) return;
    const t = setTimeout(() => void save(true), 2000);
    return () => clearTimeout(t);
  }, [form, locked, save]);

  // Warn before closing the tab with unsaved copy in the box.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    dirty.current = true;
    setSaveState("idle");
    setForm((f) => ({ ...f, [key]: value }));

    // The second version is written in the opposite language, so switching the
    // language of the original makes whatever is there meaningless. Drop it
    // rather than silently filing it under the wrong language.
    if (key === "language" && value !== article.language && secondVersion) {
      void fetch(`/api/drafts/${article.id}/translation`, { method: "DELETE" });
      setSecondKey((n) => n + 1);
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      body.append("articleId", article.id);
      const res = await fetch("/api/uploads", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error ?? `Could not upload ${file.name}`);
        continue;
      }
      const { media: created } = await res.json();
      setMedia((m) => [...m, created]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function removeMedia(id: string) {
    const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    if (res.ok) setMedia((m) => m.filter((x) => x.id !== id));
  }

  async function submit() {
    setMessage(null);
    await save(true);
    const res = await fetch(`/api/drafts/${article.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactPhone: contact.phone,
        contactWhatsapp: contact.whatsapp,
        witnesses,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error ?? w("submit.failed"));
      return;
    }
    setStatus("SUBMITTED");
    setSubmitted(true);
    setMessage(null);
    router.refresh();
  }

  const words = form.body.trim().split(/\s+/).filter(Boolean).length;
  const otherName = form.language === "EN" ? "বাংলা (Bangla)" : "English";

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-10">
        <svg viewBox="0 0 24 24" aria-hidden className="mx-auto size-12 fill-none stroke-emerald-600 stroke-2">
          <circle cx="12" cy="12" r="10" />
          <path d="m8 12.5 2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-3 font-serif text-2xl font-bold text-emerald-900">
          {w("submit.done")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-emerald-900">
          An editor will read <span className="font-medium">{form.title}</span>, make any changes
          they need, and set your payout when they approve it. You will see the decision and the
          amount on your dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark"
          >
            {w("submit.backToDesk")}
          </Link>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="rounded-full border border-emerald-300 px-5 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            {w("submit.viewPiece")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <span className="text-xs text-ink-soft">
            {words} word{words === 1 ? "" : "s"}
            {saveState === "saving" ? " · saving..." : ""}
            {saveState === "saved" ? " · saved" : ""}
            {saveState === "error" ? " · save failed" : ""}
          </span>
        </div>

        <div className="flex gap-2">
          {!locked ? (
            <>
              <button
                type="button"
                name="save-draft"
                onClick={() => void save()}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
              >
                {w("compose.saveDraft")}
              </button>
              <button
                type="button"
                name="submit-article"
                onClick={() => void submit()}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                {status === "REJECTED" ? w("submit.resubmit") : w("submit.button")}
              </button>
            </>
          ) : (
            <span className="rounded-full border border-line bg-paper-soft px-4 py-2 text-xs text-ink-soft">
              {status === "SUBMITTED" ? w("submit.locked") : w("submit.published")}
            </span>
          )}
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">{message}</p>
      ) : null}

      {lastNote?.note ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            lastNote.action === "REJECTED"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide">
            {lastNote.action === "REJECTED" ? w("submit.changesRequested") : w("submit.editorNote")} ·{" "}
            {lastNote.editor}
          </p>
          <p className="mt-1">{lastNote.note}</p>
        </div>
      ) : null}

      <input
        name="title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
        disabled={locked}
        lang={form.language === "BN" ? "bn" : "en"}
        placeholder={w("compose.headline")}
        className="w-full border-b border-line pb-2 font-serif text-2xl font-bold outline-none placeholder:text-ink-soft/50 focus:border-navy disabled:bg-transparent sm:text-3xl"
      />

      <input
        name="dek"
        value={form.dek}
        onChange={(e) => update("dek", e.target.value)}
        disabled={locked}
        placeholder={w("compose.dek")}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy"
      />

      {/* The desk often files a piece on behalf of a correspondent. A
          contributor never needs this: their own name is the byline. */}
      {isStaff ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{w("compose.bylineLabel")}</span>
          <input
            value={form.bylineName}
            onChange={(e) => update("bylineName", e.target.value)}
            disabled={locked}
            placeholder={`Leave empty to publish under ${article.authorName}`}
            maxLength={120}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy sm:max-w-sm"
          />
          <span className="text-xs text-ink-soft">
            {w("compose.bylineNote")}
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{w("compose.section")}</span>
          <select
            name="category"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            disabled={locked}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{w("compose.writingIn")}</span>
          <select
            name="language"
            value={form.language}
            onChange={(e) => update("language", e.target.value)}
            disabled={locked}
            className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
          >
            <option value="BN">বাংলা</option>
            <option value="EN">English</option>
          </select>
          <span className="text-xs text-ink-soft">
            {labels[form.language]["compose.editorWritesOther"].replace(
              "{other}",
              form.language === "EN" ? "বাংলা" : "English",
            )}
          </span>
        </label>
      </div>

      <div>
        <FormatToolbar
          textareaRef={bodyRef}
          value={form.body}
          onChange={(next) => update("body", next)}
          disabled={locked}
        />
        <textarea
          ref={bodyRef}
          value={form.body}
          onChange={(e) => update("body", e.target.value)}
          onKeyDown={(e) => {
            // The shortcuts people already have in their fingers.
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key !== "b" && key !== "i") return;
            e.preventDefault();
            const el = bodyRef.current;
            if (!el) return;
            const mark = key === "b" ? "**" : "*";
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? 0;
            const chosen = form.body.slice(start, end) || (key === "b" ? "bold text" : "italic text");
            update("body", form.body.slice(0, start) + mark + chosen + mark + form.body.slice(end));
            requestAnimationFrame(() => {
              el.focus();
              el.setSelectionRange(start + mark.length, start + mark.length + chosen.length);
            });
          }}
          disabled={locked}
          lang={form.language === "BN" ? "bn" : "en"}
          rows={18}
          placeholder={w("compose.body")}
          className="prose-article w-full rounded-b-xl border border-line p-4 outline-none focus:border-navy"
        />
      </div>

      <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{w("compose.mediaTitle")}</h2>
            <p className="text-xs text-ink-soft">
              {w("compose.mediaNote")}
            </p>
          </div>
          {!locked ? (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,video/mp4,video/webm"
                onChange={(e) => void upload(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                name="attach-media"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
              >
                {uploading ? w("compose.uploading") : w("compose.attach")}
              </button>
            </>
          ) : null}
        </div>

        {media.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((m) => (
              <li key={m.id} className="group relative overflow-hidden rounded-lg bg-paper-soft">
                {m.kind === "VIDEO" ? (
                  <video src={m.url} className="aspect-4/3 w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="aspect-4/3 w-full object-cover" />
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                  {m.kind}
                </span>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => void removeMedia(m.id)}
                    aria-label="Remove attachment"
                    className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-navy-dark"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-soft">
            {w("compose.mediaEmpty")}
          </p>
        )}
      </section>

      {!locked && !isStaff ? (
        <section className="rounded-xl border border-line p-4">
          <h2 className="text-sm font-medium">{w("submit.contactTitle")}</h2>
          <p className="mt-0.5 text-xs text-ink-soft">{w("submit.contactNote")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{w("submit.phone")}</span>
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{w("submit.whatsapp")}</span>
              <input
                value={contact.whatsapp}
                onChange={(e) => setContact({ ...contact, whatsapp: e.target.value })}
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
              />
            </label>
          </div>

          {/* Optional, and in the contributor's own language: the desk may want
              to speak to somebody who was there. */}
          <label className="mt-4 grid gap-1 text-sm" lang={form.language === "BN" ? "bn" : "en"}>
            <span className="font-medium">{w("submit.witnessLabel")}</span>
            <textarea
              value={witnesses}
              onChange={(e) => setWitnesses(e.target.value)}
              rows={3}
              maxLength={2000}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
            />
            <span className="text-xs text-ink-soft">{w("submit.witnessNote")}</span>
          </label>
        </section>
      ) : null}

      <SecondVersion
        key={secondKey}
        articleId={article.id}
        otherName={otherName}
        otherLang={form.language === "EN" ? "bn" : "en"}
        locked={locked}
        initial={secondKey === 0 ? secondVersion : null}
        beforeSave={() => save(true)}
      />

      {status === "APPROVED" ? (
        <Link
          href={`/article/${article.slug}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          {w("submit.viewPublished")} &rarr;
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Optional second language, written by the contributor. Filling this in means
 * the piece is submitted for both sections at once; leaving it empty means an
 * editor writes it. Either way nothing is published until an editor approves.
 */
function SecondVersion({
  articleId,
  otherName,
  otherLang,
  locked,
  initial,
  beforeSave,
}: {
  articleId: string;
  otherName: string;
  otherLang: string;
  locked: boolean;
  initial: { title: string; dek: string; body: string; byEditor: boolean } | null;
  /** Persists the main form first - the server decides the second language from
   *  what is stored, so an unsaved language change would file it wrongly. */
  beforeSave: () => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initial));
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    dek: initial?.dek ?? "",
    body: initial?.body ?? "",
  });
  const [saved, setSaved] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setNote(null);
    await beforeSave();
    const res = await fetch(`/api/drafts/${articleId}/translation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNote(data.error ?? "Could not save that version.");
      return;
    }
    setSaved(true);
    setNote(`${otherName} version saved. This piece now goes to both sections.`);
    router.refresh();
  }

  async function drop() {
    setBusy(true);
    await fetch(`/api/drafts/${articleId}/translation`, { method: "DELETE" });
    setBusy(false);
    setSaved(false);
    setForm({ title: "", dek: "", body: "" });
    setNote("Removed. An editor will write that version instead.");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Also submit in {otherName}</h2>
          <p className="text-xs text-ink-soft">
            Optional. Write it yourself and your piece goes to both sections, or leave it and an
            editor translates it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              saved
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-line bg-paper-soft text-ink-soft"
            }`}
          >
            {saved ? (initial?.byEditor ? "Editor's version" : "Both sections") : "One section"}
          </span>
          {!locked ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper-soft"
            >
              {open ? "Hide" : saved ? "Edit" : "Add it"}
            </button>
          ) : null}
        </div>
      </div>

      {note ? (
        <p className="mt-3 rounded-lg border border-line bg-paper-soft px-3 py-2 text-sm">{note}</p>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-2">
          <input
            value={form.title}
            lang={otherLang}
            disabled={locked}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={otherLang === "bn" ? "শিরোনাম" : "Headline"}
            className="w-full rounded-lg border border-line px-3 py-2 font-serif text-base font-bold outline-none focus:border-navy"
          />
          <input
            value={form.dek}
            lang={otherLang}
            disabled={locked}
            onChange={(e) => setForm({ ...form, dek: e.target.value })}
            placeholder={otherLang === "bn" ? "সংক্ষিপ্ত বিবরণ" : "Standfirst"}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <textarea
            value={form.body}
            lang={otherLang}
            disabled={locked}
            rows={10}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={otherLang === "bn" ? "এখানে বাংলা সংস্করণ লিখুন" : "Write the English version here"}
            className="prose-article w-full rounded-lg border border-line p-3 outline-none focus:border-navy"
          />
          {!locked ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy || !form.title.trim() || !form.body.trim()}
                className="rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
              >
                {busy ? "Saving..." : saved ? `Update ${otherName} version` : `Save ${otherName} version`}
              </button>
              {saved ? (
                <button
                  type="button"
                  onClick={() => void drop()}
                  disabled={busy}
                  className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-50"
                >
                  Remove it
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
