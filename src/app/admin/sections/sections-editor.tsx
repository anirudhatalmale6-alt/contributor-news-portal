"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { key: string; slug: string; inMenu: boolean; en: string; bn: string; articles: number };

const field = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-navy";

/**
 * The paper's sections in one table. Changes stay on screen until "Save
 * sections"; adding and removing happen straight away, because they each need
 * their own confirmation anyway.
 */
export function SectionsEditor({ initial, limits }: { initial: Row[]; limits: { left: number; list: number } }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [fresh, setFresh] = useState({ en: "", bn: "" });
  const [removing, setRemoving] = useState<{ key: string; moveTo: string } | null>(null);

  const changed = JSON.stringify(rows) !== JSON.stringify(saved);
  const addressChanged = rows.some((r) => saved.find((s) => s.key === r.key)?.slug !== r.slug);

  function edit(key: string, patch: Partial<Row>) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function move(index: number, by: -1 | 1) {
    const to = index + by;
    // General always stays at the bottom.
    if (to < 0 || to >= rows.length || rows[to].key === "General" || rows[index].key === "General") return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);
  }

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    return { ok: res.ok, data };
  }

  async function save() {
    if (addressChanged && !window.confirm("You changed a web address. Links to the old address will stop working. Save anyway?")) {
      return;
    }
    const { ok, data } = await call("/api/admin/sections", "PUT", {
      sections: rows.map((r, position) => ({ key: r.key, slug: r.slug, position, inMenu: r.inMenu, en: r.en, bn: r.bn })),
    });
    if (!ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save the sections." });
      return;
    }
    setSaved(rows);
    setMessage({ kind: "ok", text: "Sections saved. The menu on both sites shows the change now." });
    router.refresh();
  }

  async function add() {
    const { ok, data } = await call("/api/admin/sections", "POST", fresh);
    if (!ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not add the section." });
      return;
    }
    setFresh({ en: "", bn: "" });
    setMessage({ kind: "ok", text: `"${fresh.en}" added to the menu, just before General.` });
    router.refresh();
    // The server decides the key and address; reload the list from it.
    window.location.reload();
  }

  async function remove() {
    if (!removing) return;
    const row = rows.find((r) => r.key === removing.key);
    if (!row) return;
    const target = rows.find((r) => r.key === removing.moveTo);
    const question = row.articles
      ? `Delete "${row.en}" and move its ${row.articles} articles to "${target?.en}"?`
      : `Delete "${row.en}"?`;
    if (!window.confirm(question)) return;
    const qs = row.articles ? `?moveTo=${encodeURIComponent(removing.moveTo)}` : "";
    const { ok, data } = await call(`/api/admin/sections/${encodeURIComponent(row.key)}${qs}`, "DELETE");
    if (!ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not delete the section." });
      return;
    }
    const rest = rows.filter((r) => r.key !== row.key).map((r) =>
      r.key === removing.moveTo ? { ...r, articles: r.articles + row.articles } : r,
    );
    setRows(rest);
    setSaved(rest);
    setRemoving(null);
    setMessage({
      kind: "ok",
      text: row.articles ? `"${row.en}" deleted. Its ${row.articles} articles are now in "${target?.en}".` : `"${row.en}" deleted.`,
    });
    router.refresh();
  }

  return (
    <div className="mt-6 grid gap-6">
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

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Bangla name</th>
              <th className="px-3 py-2">English name</th>
              <th className="px-3 py-2">Web address</th>
              <th className="px-3 py-2">In menu</th>
              <th className="px-3 py-2 text-right">Articles</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} data-section={r.key} className="border-t border-line align-middle">
                <td className="px-3 py-2">
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${r.en} up`}
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || r.key === "General"}
                      className="rounded border border-line px-2 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${r.en} down`}
                      onClick={() => move(i, 1)}
                      disabled={i === rows.length - 1 || rows[i + 1]?.key === "General" || r.key === "General"}
                      className="rounded border border-line px-2 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <input lang="bn" name={`bn-${r.key}`} value={r.bn} onChange={(e) => edit(r.key, { bn: e.target.value })} className={field} />
                </td>
                <td className="px-3 py-2">
                  <input name={`en-${r.key}`} value={r.en} onChange={(e) => edit(r.key, { en: e.target.value })} className={field} />
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1 text-xs text-ink-soft">
                    /section/
                    <input
                      name={`slug-${r.key}`}
                      value={r.slug}
                      onChange={(e) => edit(r.key, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      className={field}
                    />
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    name={`menu-${r.key}`}
                    checked={r.inMenu}
                    disabled={r.key === "General"}
                    onChange={(e) => edit(r.key, { inMenu: e.target.checked })}
                    className="size-4"
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.articles}</td>
                <td className="px-3 py-2 text-right">
                  {r.key === "General" ? (
                    <span className="text-xs text-ink-soft">older pieces</span>
                  ) : (
                    <button
                      type="button"
                      name={`delete-${r.key}`}
                      onClick={() => setRemoving({ key: r.key, moveTo: rows.find((x) => x.key !== r.key)?.key ?? "General" })}
                      className="text-xs font-medium text-rose-800 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {removing ? (
        <div className="grid gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          {(() => {
            const row = rows.find((r) => r.key === removing.key);
            if (!row) return null;
            return (
              <>
                <p className="font-medium">Delete &quot;{row.en}&quot;?</p>
                {row.articles ? (
                  <label className="grid gap-1">
                    <span>Its {row.articles} articles must go somewhere first. Move them to:</span>
                    <select
                      name="move-to"
                      value={removing.moveTo}
                      onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })}
                      className="max-w-xs rounded-lg border border-line bg-paper px-3 py-2"
                    >
                      {rows
                        .filter((r) => r.key !== row.key)
                        .map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.en} / {r.bn}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <p>It has no articles.</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    name="confirm-delete-section"
                    onClick={() => void remove()}
                    disabled={busy}
                    className="rounded-full bg-rose-800 px-4 py-2 font-medium text-white disabled:opacity-50"
                  >
                    {row.articles ? "Move the articles and delete" : "Delete"}
                  </button>
                  <button type="button" onClick={() => setRemoving(null)} className="text-sm font-medium hover:underline">
                    Cancel
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          name="save-sections"
          onClick={() => void save()}
          disabled={busy || !changed}
          className="rounded-full bg-navy px-5 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save sections"}
        </button>
        {changed ? <span className="text-xs text-amber-800">Unsaved changes</span> : null}
      </div>

      <section className="grid gap-3 rounded-xl border border-line p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Add a section</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Bangla name</span>
            <input lang="bn" name="new-bn" value={fresh.bn} onChange={(e) => setFresh({ ...fresh, bn: e.target.value })} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">English name</span>
            <input name="new-en" value={fresh.en} onChange={(e) => setFresh({ ...fresh, en: e.target.value })} className={field} />
          </label>
          <button
            type="button"
            name="add-section"
            onClick={() => void add()}
            disabled={busy || !fresh.en.trim() || !fresh.bn.trim()}
            className="rounded-full border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            Add section
          </button>
        </div>
      </section>

      <section className="grid gap-2 rounded-xl border border-line bg-paper-soft p-4 text-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">What each section page shows</h2>
        <p>
          Every section page uses the same layout. Two numbers in Settings decide how many stories it
          holds: the left column (now {limits.left}) and the list of more stories underneath (now{" "}
          {limits.list}).{" "}
          <a href="/admin#site-settings" className="font-medium text-navy underline">
            Change them in Settings
          </a>
          .
        </p>
        <p>
          Which story leads a section is chosen per article: open it in the Newsroom and tick
          &quot;Lead of its section page&quot;.
        </p>
      </section>
    </div>
  );
}
