"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormatToolbar } from "@/components/format-toolbar";

type PageRow = {
  id: string;
  slug: string;
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  published: boolean;
  inFooter: boolean;
  footerOrder: number;
};

const BLANK: Omit<PageRow, "id" | "slug"> & { slug: string } = {
  slug: "",
  titleBn: "",
  titleEn: "",
  bodyBn: "",
  bodyEn: "",
  published: false,
  inFooter: true,
  footerOrder: 0,
};

/** One language of a page: its title and its text, with the formatting buttons. */
function LanguageBox({
  label,
  lang,
  title,
  body,
  onTitle,
  onBody,
  name,
}: {
  label: string;
  lang: "bn" | "en";
  title: string;
  body: string;
  onTitle: (v: string) => void;
  onBody: (v: string) => void;
  name: "Bn" | "En";
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="grid gap-2">
      <span className="text-xs font-bold uppercase tracking-widest text-ink-soft">{label}</span>
      <input
        name={`title${name}`}
        lang={lang}
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder={lang === "bn" ? "পাতার শিরোনাম" : "Page title"}
        className="rounded-lg border border-line px-3 py-2 font-serif text-lg font-bold outline-none focus:border-navy"
      />
      <div>
        <FormatToolbar textareaRef={ref} value={body} onChange={onBody} />
        <textarea
          ref={ref}
          name={`body${name}`}
          lang={lang}
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={12}
          placeholder={lang === "bn" ? "এখানে লিখুন" : "Write the page here"}
          className="prose-article w-full rounded-b-xl border border-line p-3 text-sm outline-none focus:border-navy"
        />
      </div>
    </div>
  );
}

/**
 * The list of pages on the left, the one being edited on the right. Nothing
 * reaches readers until "Published" is ticked and the page is saved.
 */
export function PagesEditor({ initial }: { initial: PageRow[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(initial[0]?.id ?? "new");
  const current = editing === "new" ? null : pages.find((p) => p.id === editing) ?? null;
  const [form, setForm] = useState<typeof BLANK>(current ? { ...current } : { ...BLANK });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function open(id: string | "new") {
    setEditing(id);
    setMessage(null);
    const row = id === "new" ? null : pages.find((p) => p.id === id);
    setForm(row ? { ...row } : { ...BLANK, footerOrder: pages.length });
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(editing === "new" ? "/api/admin/pages" : `/api/admin/pages/${editing}`, {
      method: editing === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save the page." });
      return;
    }
    const saved = data.page as PageRow;
    setPages((list) =>
      (editing === "new" ? [...list, saved] : list.map((p) => (p.id === saved.id ? saved : p))).sort(
        (a, b) => a.footerOrder - b.footerOrder,
      ),
    );
    setEditing(saved.id);
    setForm({ ...saved });
    setMessage({
      kind: "ok",
      text: saved.published
        ? `Saved and live at /p/${saved.slug} (English: /en/p/${saved.slug}).`
        : "Saved as a draft. Tick Published and save again to put it on the site.",
    });
    router.refresh();
  }

  async function remove() {
    if (!current) return;
    const name = current.titleEn || current.titleBn;
    if (!window.confirm(`Delete "${name}"? Its footer link goes too. This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/pages/${current.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: "Could not delete the page." });
      return;
    }
    const rest = pages.filter((p) => p.id !== current.id);
    setPages(rest);
    // Open the next page first: opening clears the message line, and the
    // confirmation has to survive it.
    open(rest[0]?.id ?? "new");
    setMessage({ kind: "ok", text: `"${name}" deleted.` });
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="grid content-start gap-1">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => open(p.id)}
            className={`rounded-lg px-3 py-2 text-left text-sm ${
              editing === p.id ? "bg-navy text-white" : "hover:bg-paper-soft"
            }`}
          >
            <span className="block font-medium">{p.titleEn || p.titleBn}</span>
            <span className={`text-xs ${editing === p.id ? "text-white/80" : "text-ink-soft"}`}>
              {p.published ? (p.inFooter ? "Live, in footer" : "Live, not in footer") : "Draft"}
            </span>
          </button>
        ))}
        <button
          type="button"
          name="new-page"
          onClick={() => open("new")}
          className={`mt-2 rounded-full border px-3 py-2 text-sm font-medium ${
            editing === "new" ? "border-navy bg-navy text-white" : "border-line hover:bg-paper-soft"
          }`}
        >
          + New page
        </button>
      </aside>

      <section className="grid content-start gap-4 rounded-xl border border-line p-4">
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

        <div className="grid gap-5 xl:grid-cols-2">
          <LanguageBox
            label="Bangla"
            lang="bn"
            name="Bn"
            title={form.titleBn}
            body={form.bodyBn}
            onTitle={(v) => setForm({ ...form, titleBn: v })}
            onBody={(v) => setForm({ ...form, bodyBn: v })}
          />
          <LanguageBox
            label="English"
            lang="en"
            name="En"
            title={form.titleEn}
            body={form.bodyEn}
            onTitle={(v) => setForm({ ...form, titleEn: v })}
            onBody={(v) => setForm({ ...form, bodyEn: v })}
          />
        </div>
        <p className="text-xs text-ink-soft">
          If one language is left empty, readers on that side see the other language instead of a
          blank page.
        </p>

        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Web address</span>
            <span className="flex items-center rounded-lg border border-line text-sm focus-within:border-navy">
              <span className="pl-3 text-ink-soft">thedocument.net/p/</span>
              <input
                name="slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="made from the English title"
                className="min-w-0 flex-1 rounded-r-lg py-2 pr-3 outline-none"
              />
            </span>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Footer order</span>
            <input
              name="footerOrder"
              inputMode="numeric"
              value={String(form.footerOrder)}
              onChange={(e) => setForm({ ...form, footerOrder: Number(e.target.value.replace(/[^0-9]/g, "") || 0) })}
              className="rounded-lg border border-line px-3 py-2 outline-none focus:border-navy"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="published"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
              className="size-4"
            />
            <span className="font-medium">Published</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="inFooter"
              checked={form.inFooter}
              onChange={(e) => setForm({ ...form, inFooter: e.target.checked })}
              className="size-4"
            />
            <span className="font-medium">Show in footer</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            name="save-page"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-full bg-navy px-5 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
          >
            {busy ? "Saving..." : editing === "new" ? "Create page" : "Save page"}
          </button>
          {current?.published ? (
            <a
              href={`/p/${current.slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-navy hover:underline"
            >
              View live
            </a>
          ) : null}
          {current ? (
            <button
              type="button"
              name="delete-page"
              onClick={() => void remove()}
              disabled={busy}
              className="ml-auto text-xs font-medium text-rose-800 hover:underline"
            >
              Delete this page
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
