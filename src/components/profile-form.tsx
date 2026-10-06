"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type ProfileFields = {
  name: string;
  bio: string;
  publicEmail: string;
  phone: string;
  website: string;
  location: string;
  image: string | null;
};

/**
 * One form for two jobs: a contributor editing their own introduction, and an
 * editor tidying someone else's. The only difference is which endpoint it
 * talks to, so the two can never drift apart.
 */
export function ProfileForm({
  initial,
  endpoint,
  method,
  photoEndpoint,
  heading,
  note,
}: {
  initial: ProfileFields;
  /** Where the text fields go: the self endpoint or the staff one. */
  endpoint: string;
  method: "PUT" | "PATCH";
  photoEndpoint: string;
  heading: string;
  note?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const field = "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy";
  const set = (key: keyof ProfileFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });
  const error = (key: string) => issues[key]?.[0];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setIssues({});
    setMessage(null);

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        bio: form.bio,
        publicEmail: form.publicEmail,
        phone: form.phone,
        website: form.website,
        location: form.location,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setIssues(data.issues ?? {});
      setMessage({ kind: "err", text: data.error ?? "Could not save the profile." });
      return;
    }
    setMessage({ kind: "ok", text: "Profile saved." });
    router.refresh();
  }

  async function uploadPhoto(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", files[0]);
    const res = await fetch(photoEndpoint, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not upload that photo." });
      return;
    }
    setForm({ ...form, image: data.user.image });
    setMessage({ kind: "ok", text: "Photo updated." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-5 rounded-xl border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{heading}</h2>
        {message ? (
          <span className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.text}
          </span>
        ) : null}
      </div>
      {note ? <p className="-mt-3 text-xs text-ink-soft">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-paper-soft">
          {form.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image} alt="" className="size-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden className="size-9 fill-none stroke-ink-soft stroke-[1.5]">
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <div className="grid gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => void uploadPhoto(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="justify-self-start rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
          >
            {form.image ? "Change photo" : "Upload a photo"}
          </button>
          <span className="text-xs text-ink-soft">A square JPEG or PNG under 5 MB.</span>
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Name shown on articles</span>
        <input name="name" value={form.name} onChange={set("name")} className={field} />
        {error("name") ? <span className="text-xs text-rose-700">{error("name")}</span> : null}
      </label>

      <label className="grid gap-1 text-sm">
        <span className="font-medium">Short introduction</span>
        <textarea
          name="bio"
          value={form.bio}
          onChange={set("bio")}
          rows={4}
          placeholder="A line or two about who you are and what you cover."
          className={field}
        />
        <span className="text-xs text-ink-soft">Shown on your public page and under your articles.</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Contact email to publish</span>
          <input
            name="publicEmail"
            value={form.publicEmail}
            onChange={set("publicEmail")}
            placeholder="Leave empty to publish none"
            className={field}
          />
          {error("publicEmail") ? (
            <span className="text-xs text-rose-700">{error("publicEmail")}</span>
          ) : null}
          <span className="text-xs text-ink-soft">
            Your sign-in email is never shown publicly.
          </span>
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Phone</span>
          <input name="phone" value={form.phone} onChange={set("phone")} className={field} />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Website or social link</span>
          <input
            name="website"
            value={form.website}
            onChange={set("website")}
            placeholder="https://"
            className={field}
          />
          {error("website") ? <span className="text-xs text-rose-700">{error("website")}</span> : null}
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium">Where you are based</span>
          <input name="location" value={form.location} onChange={set("location")} className={field} />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
