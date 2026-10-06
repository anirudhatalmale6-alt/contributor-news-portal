"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewDraftButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled draft", language: "BN" }),
    });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    const { article } = await res.json();
    router.push(`/dashboard/write/${article.id}`);
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {busy ? "Opening editor..." : "Start a new piece"}
    </button>
  );
}
