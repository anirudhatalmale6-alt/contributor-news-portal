"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const DOT: Record<string, string> = {
  PUBLISHED: "bg-emerald-600",
  REJECTED: "bg-amber-500",
  ROLE: "bg-navy",
  PAYOUT: "bg-brand",
};

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * What the newsroom has decided about this person's work, newest first.
 *
 * Sits at the top of their desk rather than behind a bell icon: a contributor
 * checks this page to see where their piece got to, so the answer belongs on
 * the page they already open.
 */
export function Notifications({ notes }: { notes: Note[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = notes.filter((n) => !n.read).length;

  if (notes.length === 0) return null;

  async function clear() {
    setBusy(true);
    await fetch("/api/notifications", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="mt-6 rounded-xl border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-serif text-lg font-bold">Updates</h2>
        {unread ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
            {unread} new
          </span>
        ) : null}
        {unread ? (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={busy}
            className="ml-auto text-xs font-medium text-navy hover:underline disabled:opacity-60"
          >
            {busy ? "Marking..." : "Mark all as read"}
          </button>
        ) : null}
      </div>

      <ul className="divide-y divide-line">
        {notes.map((n) => {
          const row = (
            <>
              <span className="flex items-start gap-2.5">
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[n.kind] ?? "bg-ink-soft"}`}
                />
                <span className="min-w-0">
                  <span className={`block text-sm ${n.read ? "font-medium" : "font-semibold"}`}>
                    {n.title}
                  </span>
                  {n.body ? (
                    <span className="mt-0.5 block text-sm text-ink-soft">{n.body}</span>
                  ) : null}
                  <span className="mt-1 block text-xs text-ink-soft">{when(n.createdAt)}</span>
                </span>
              </span>
            </>
          );
          return (
            <li key={n.id} className={n.read ? "" : "bg-paper-soft"}>
              {n.href ? (
                <Link href={n.href} className="block px-4 py-3 hover:bg-paper-soft">
                  {row}
                </Link>
              ) : (
                <div className="px-4 py-3">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
