"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Notice = { id: string; body: string; forEveryone: boolean };

/**
 * What the desk wants this contributor to see.
 *
 * Sits at the top of their dashboard until they close it. Closing it is
 * recorded against them alone, so a notice for everybody stays up for
 * everybody else.
 */
export function NoticeBoard({ notices }: { notices: Notice[] }) {
  const router = useRouter();
  const [closed, setClosed] = useState<string[]>([]);
  const open = notices.filter((n) => !closed.includes(n.id));
  if (open.length === 0) return null;

  async function dismiss(id: string) {
    setClosed((c) => [...c, id]);
    await fetch(`/api/notices/${id}`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mb-6 grid gap-2">
      {open.map((n) => (
        <div
          key={n.id}
          role="status"
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-navy/20 bg-navy/5 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy">
              {n.forEveryone ? "From the newsroom" : "A message for you"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
          </div>
          <button
            type="button"
            name="dismiss-notice"
            onClick={() => void dismiss(n.id)}
            className="shrink-0 rounded-full border border-navy px-3 py-1.5 text-xs font-medium text-navy hover:bg-navy hover:text-white"
          >
            Got it
          </button>
        </div>
      ))}
    </div>
  );
}
