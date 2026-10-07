"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Filling an advertising box with a picture instead of code.
 *
 * The owner has an image from an advertiser and a web address to send clicks
 * to. This turns those two things into the markup the slot needs, so nobody has
 * to paste HTML to sell a banner.
 */
export function AdUploader({
  slot,
  label,
  size,
  current,
}: {
  slot: string;
  label: string;
  size: string;
  current: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const filled = current.trim().length > 0;

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", file);
    body.append("slot", slot);
    body.append("alt", label);
    if (link.trim()) body.append("link", link.trim());

    const res = await fetch("/api/admin/site/ad-image", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not upload that image." });
      return;
    }
    setMessage({ kind: "ok", text: "Uploaded. The box now shows your image." });
    router.refresh();
  }

  async function clear() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/site/ad-image?slot=${slot}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: "Could not empty that box." });
      return;
    }
    setMessage({ kind: "ok", text: "Emptied. That space disappears from the page." });
    router.refresh();
  }

  return (
    <div className="grid gap-2 rounded-lg border border-line bg-paper-soft/60 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-ink-soft">{size}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
            filled ? "bg-emerald-50 text-emerald-800" : "bg-paper text-ink-soft"
          }`}
        >
          {filled ? "Showing" : "Hidden (empty)"}
        </span>
      </div>

      <label className="grid gap-1 text-xs">
        <span className="text-ink-soft">Send clicks to (optional)</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://advertiser.example.com"
          className="rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-navy"
        />
      </label>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-full bg-navy px-3.5 py-1.5 text-xs font-medium text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {busy ? "Working..." : filled ? "Replace the image" : "Upload an image"}
        </button>
        {filled ? (
          <button
            type="button"
            onClick={() => void clear()}
            disabled={busy}
            className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium hover:bg-paper-soft disabled:opacity-60"
          >
            Remove and hide
          </button>
        ) : null}
      </div>

      {message ? (
        <p className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
