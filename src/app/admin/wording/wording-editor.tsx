"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Line = {
  key: string;
  group: string;
  note: string;
  /** What the site shipped with, in each language. */
  shipped: { EN: string; BN: string };
  /** What the owner has written, empty where he has not. */
  value: { EN: string; BN: string };
};

/**
 * Every word the site says, in both languages, in one screen.
 *
 * The shipped wording is the placeholder rather than the value, so an empty box
 * genuinely means "use what it came with" and emptying a box is how you undo a
 * change. Only what was actually edited is sent.
 */
export function WordingEditor({ lines, groups }: { lines: Line[]; groups: string[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const id = (key: string, locale: "EN" | "BN") => `${locale}:${key}`;
  const valueOf = (line: Line, locale: "EN" | "BN") =>
    edits[id(line.key, locale)] ?? line.value[locale];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) =>
      [l.key, l.note, l.shipped.EN, l.shipped.BN, l.value.EN, l.value.BN]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [lines, query]);

  const changed = Object.entries(edits).filter(([k, v]) => {
    const [locale, key] = [k.slice(0, 2) as "EN" | "BN", k.slice(3)];
    const line = lines.find((l) => l.key === key);
    return line ? v !== line.value[locale] : false;
  });

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/wording", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: changed.map(([k, value]) => ({
          locale: k.slice(0, 2),
          key: k.slice(3),
          value,
        })),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not save those words." });
      return;
    }
    setEdits({});
    setMessage({
      kind: "ok",
      text: `Saved ${data.saved ?? changed.length} line${
        (data.saved ?? changed.length) === 1 ? "" : "s"
      }. The site is using your wording now.`,
    });
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-navy";

  return (
    <div className="grid gap-4">
      {/* The save bar follows you down the page: the list is long and the
          button being at the bottom of it would be a button nobody finds. */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the wording, for example: headline, submit, section"
          className={`${field} max-w-md flex-1`}
        />
        <span className="text-xs text-ink-soft">
          {changed.length > 0
            ? `${changed.length} line${changed.length === 1 ? "" : "s"} changed`
            : `${matches.length} of ${lines.length} lines`}
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || changed.length === 0}
          className="ml-auto rounded-full bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-40"
        >
          {busy ? "Saving..." : "Save wording"}
        </button>
      </div>

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

      {groups.map((group) => {
        const here = matches.filter((l) => l.group === group);
        if (here.length === 0) return null;
        return (
          <section key={group} className="rounded-xl border border-line">
            <h2 className="border-b border-line px-4 py-2.5 font-serif text-lg font-bold">
              {group}
            </h2>
            <div className="divide-y divide-line">
              {here.map((line) => {
                const edited =
                  valueOf(line, "EN").trim().length > 0 || valueOf(line, "BN").trim().length > 0;
                return (
                  <div key={line.key} className="grid gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-xs text-ink-soft">{line.note || line.key}</span>
                      {edited ? (
                        <button
                          type="button"
                          onClick={() =>
                            setEdits((e) => ({
                              ...e,
                              [id(line.key, "EN")]: "",
                              [id(line.key, "BN")]: "",
                            }))
                          }
                          className="ml-auto text-xs text-ink-soft underline hover:text-ink"
                        >
                          Put this line back to the original
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(["BN", "EN"] as const).map((locale) => (
                        <label key={locale} className="grid gap-1">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                            {locale === "BN" ? "বাংলা site" : "English site"}
                          </span>
                          <textarea
                            name={`${locale}:${line.key}`}
                            rows={line.shipped[locale].length > 70 ? 3 : 1}
                            lang={locale === "BN" ? "bn" : "en"}
                            value={valueOf(line, locale)}
                            placeholder={line.shipped[locale]}
                            onChange={(e) =>
                              setEdits((prev) => ({ ...prev, [id(line.key, locale)]: e.target.value }))
                            }
                            className={`${field} ${locale === "BN" ? "prose-article" : ""}`}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {matches.length === 0 ? (
        <p className="rounded-xl border border-line px-4 py-6 text-center text-sm text-ink-soft">
          Nothing in the wording matches that.
        </p>
      ) : null}
    </div>
  );
}
