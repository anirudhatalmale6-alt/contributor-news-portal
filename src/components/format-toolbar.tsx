"use client";

import type { RefObject } from "react";

type Action =
  | { kind: "wrap"; before: string; after: string }
  | { kind: "prefix"; text: string };

const BUTTONS: { label: string; title: string; style?: string; action: Action }[] = [
  {
    label: "B",
    title: "Bold (Ctrl+B)",
    style: "font-bold",
    action: { kind: "wrap", before: "**", after: "**" },
  },
  {
    label: "I",
    title: "Italic (Ctrl+I)",
    style: "italic font-serif",
    action: { kind: "wrap", before: "*", after: "*" },
  },
  {
    label: "Big subtitle",
    title: "A section heading inside the article",
    style: "font-serif font-bold text-base",
    action: { kind: "prefix", text: "## " },
  },
  {
    label: "Small subtitle",
    title: "A smaller heading under a section",
    style: "font-serif font-bold text-[13px]",
    action: { kind: "prefix", text: "### " },
  },
  {
    label: "Quote",
    title: "A pulled-out quotation",
    action: { kind: "prefix", text: "> " },
  },
  {
    label: "List",
    title: "A bulleted list",
    action: { kind: "prefix", text: "- " },
  },
];

/**
 * Formatting for the writing desk.
 *
 * It edits the text itself rather than hiding it behind a rich-text widget, so
 * what a writer sees in the box is exactly what gets stored and exactly what
 * the reader's page is built from. No pasted Word markup, no invisible spans.
 */
export function FormatToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  function apply(action: Action) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    if (action.kind === "wrap") {
      const selected = value.slice(start, end) || (action.before === "**" ? "bold text" : "italic text");
      const next = value.slice(0, start) + action.before + selected + action.after + value.slice(end);
      onChange(next);
      // Leave the words selected so a second press, or typing, replaces them.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + action.before.length, start + action.before.length + selected.length);
      });
      return;
    }

    // A prefix belongs at the start of the line, not where the cursor happens
    // to be, so find the line and put it there - and take it off again if it is
    // already on, which is what makes these behave like toggles.
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = value.indexOf("\n", start) === -1 ? value.length : value.indexOf("\n", start);
    const line = value.slice(lineStart, lineEnd);
    const stripped = line.replace(/^(#{1,3} |> |- )/, "");
    const already = line.startsWith(action.text);
    const nextLine = already ? stripped : action.text + stripped;
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const shift = nextLine.length - line.length;
      el.setSelectionRange(start + shift, end + shift);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-t-xl border border-b-0 border-line bg-paper-soft px-2 py-1.5">
      {BUTTONS.map((b) => (
        <button
          key={b.label}
          type="button"
          title={b.title}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(b.action)}
          className={`rounded px-2.5 py-1 text-xs text-ink-soft hover:bg-paper hover:text-ink disabled:opacity-50 ${b.style ?? ""}`}
        >
          {b.label}
        </button>
      ))}
      <span className="ml-auto hidden pr-1 text-[11px] text-ink-soft sm:inline">
        Select words, then press a button
      </span>
    </div>
  );
}
