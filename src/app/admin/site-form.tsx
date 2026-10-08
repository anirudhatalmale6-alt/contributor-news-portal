"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdUploader } from "./ad-uploader";
import { BANGLA_FONTS } from "@/lib/fonts";

type Site = {
  siteNameEn: string;
  siteNameBn: string;
  taglineEn: string;
  taglineBn: string;
  footerEn: string;
  footerBn: string;
  logoUrl: string | null;
  adsEnabled: boolean;
  adHomeHtml: string;
  adArticleHtml: string;
  adSectionHtml: string;
  adBannerHtml: string;
  adSquareHtml: string;
  adHomeHtmlEn: string;
  adArticleHtmlEn: string;
  adSectionHtmlEn: string;
  adBannerHtmlEn: string;
  adSquareHtmlEn: string;
  banglaFont: string;
};

/**
 * Everything the owner can change without a developer: the masthead image, the
 * wording in both languages, and the advertising slots.
 */
export function SiteForm({ settings }: { settings: Site }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const field = "w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-navy";
  const set = (key: keyof Site) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/site", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    setMessage(
      res.ok
        ? { kind: "ok", text: "Saved. Refresh the public site to see it." }
        : { kind: "err", text: "Could not save those settings." },
    );
    router.refresh();
  }

  async function uploadLogo(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    const body = new FormData();
    body.append("file", files[0]);
    const res = await fetch("/api/admin/site/logo", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ kind: "err", text: data.error ?? "Could not upload that file." });
      return;
    }
    setForm({ ...form, logoUrl: data.settings.logoUrl });
    setMessage({ kind: "ok", text: "New logo in place." });
    router.refresh();
  }

  return (
    <form id="site-settings" onSubmit={save} className="mt-6 grid gap-5 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Site settings
        </h2>
        {message ? (
          <span className={`text-xs ${message.kind === "ok" ? "text-emerald-700" : "text-rose-700"}`}>
            {message.text}
          </span>
        ) : null}
      </div>

      <section className="grid gap-3">
        <p className="text-sm font-medium">Masthead</p>
        <div className="flex flex-wrap items-center gap-4">
          <span className="rounded-lg border border-line bg-paper-soft p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.logoUrl || "/brand/the-document-masthead.png"}
              alt="Current logo"
              className="h-10 w-auto"
            />
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void uploadLogo(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft disabled:opacity-60"
          >
            Upload a new logo
          </button>
          {form.logoUrl ? (
            <button
              type="button"
              onClick={() => setForm({ ...form, logoUrl: null })}
              className="text-xs text-ink-soft underline hover:text-ink"
            >
              Back to the original
            </button>
          ) : null}
        </div>
        <p className="text-xs text-ink-soft">
          A wide PNG with a transparent background works best. Press Save settings afterwards.
        </p>
      </section>

      <section className="grid gap-3 border-t border-line pt-4">
        <p className="text-sm font-medium">Wording</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Site name (English)</span>
            <input name="siteNameEn" value={form.siteNameEn} onChange={set("siteNameEn")} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Site name (বাংলা)</span>
            <input name="siteNameBn" value={form.siteNameBn} onChange={set("siteNameBn")} lang="bn" className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Tagline (English)</span>
            <input name="taglineEn" value={form.taglineEn} onChange={set("taglineEn")} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Tagline (বাংলা)</span>
            <input name="taglineBn" value={form.taglineBn} onChange={set("taglineBn")} lang="bn" className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Footer line (English)</span>
            <input name="footerEn" value={form.footerEn} onChange={set("footerEn")} className={field} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Footer line (বাংলা)</span>
            <input name="footerBn" value={form.footerBn} onChange={set("footerBn")} lang="bn" className={field} />
          </label>
        </div>
      </section>

      <section className="grid gap-3 border-t border-line pt-4">
        <p className="text-sm font-medium">Bangla reading font</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {BANGLA_FONTS.map((f) => (
            <label
              key={f.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                form.banglaFont === f.value ? "border-navy bg-paper-soft" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="banglaFont"
                value={f.value}
                checked={form.banglaFont === f.value}
                onChange={() => setForm({ ...form, banglaFont: f.value })}
                className="mt-1 size-4"
              />
              <span>
                <span className="block text-sm font-medium">{f.label}</span>
                <span
                  lang="bn"
                  style={{ fontFamily: f.css }}
                  className="mt-1 block text-lg leading-relaxed"
                >
                  সংবাদপত্রের পাতায় আজকের খবর
                </span>
                <span className="mt-1 block text-xs text-ink-soft">{f.note}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-soft">
          Prothom Alo reads in Shurjo, which is their own licensed typeface and cannot be copied
          onto another site. These are the closest freely licensed faces, hosted with the site.
        </p>
      </section>

      <section className="grid gap-3 border-t border-line pt-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="adsEnabled"
            checked={form.adsEnabled}
            onChange={(e) => setForm({ ...form, adsEnabled: e.target.checked })}
            className="mt-0.5 size-4"
          />
          <span>
            <span className="font-medium">Show advertising</span>
            <span className="mt-0.5 block text-xs text-ink-soft">
              Each half of the paper sells its own space. What you put under বাংলা appears only on
              the Bangla site, and what you put under English appears only on the English one. An
              empty box shows nothing at all, so the page never has a blank gap in it.
            </span>
          </span>
        </label>

        {/* The picture route first: most advertisers send an image, not code. */}
        <div className="grid gap-5 lg:grid-cols-2">
          {([
            { suffix: "", heading: "বাংলা site", note: "thedocument.net" },
            { suffix: "En", heading: "English site", note: "thedocument.net/en" },
          ] as const).map(({ suffix, heading, note }) => (
            <div key={heading} className="grid gap-3 rounded-xl border border-line p-3">
              <p className="text-sm font-semibold">
                {heading} <span className="font-normal text-xs text-ink-soft">{note}</span>
              </p>
              <AdUploader
                slot={`banner${suffix}`}
                label="Banner"
                size="970 x 90 (phones 320 x 100)"
                current={suffix ? form.adBannerHtmlEn : form.adBannerHtml}
              />
              <AdUploader
                slot={`square${suffix}`}
                label="Square"
                size="300 x 250"
                current={suffix ? form.adSquareHtmlEn : form.adSquareHtml}
              />
              <AdUploader
                slot={`home${suffix}`}
                label="Home page extra"
                size="300 x 250 or taller"
                current={suffix ? form.adHomeHtmlEn : form.adHomeHtml}
              />
              <AdUploader
                slot={`article${suffix}`}
                label="Article page"
                size="728 x 90 or 300 x 250"
                current={suffix ? form.adArticleHtmlEn : form.adArticleHtml}
              />
            </div>
          ))}
        </div>

        <details className="rounded-lg border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Or paste code from an ad network
          </summary>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Home page slot, 300 x 250 or taller</span>
            <textarea name="adHomeHtml" value={form.adHomeHtml} onChange={set("adHomeHtml")} rows={3} className={`${field} font-mono text-xs`} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Article page slot, 728 x 90 or 300 x 250</span>
            <textarea name="adArticleHtml" value={form.adArticleHtml} onChange={set("adArticleHtml")} rows={3} className={`${field} font-mono text-xs`} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">Section page slot, 728 x 90</span>
            <textarea name="adSectionHtml" value={form.adSectionHtml} onChange={set("adSectionHtml")} rows={3} className={`${field} font-mono text-xs`} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">
              Banner, 970 x 90 on a desktop and 320 x 100 on a phone. Runs under the menu on the
              front and section pages, and part-way down an article.
            </span>
            <textarea name="adBannerHtml" value={form.adBannerHtml} onChange={set("adBannerHtml")} rows={3} className={`${field} font-mono text-xs`} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-ink-soft">
              Square, 300 x 250. Sits in the right-hand column beside the news, and at the top of
              the panel on an article page.
            </span>
            <textarea name="adSquareHtml" value={form.adSquareHtml} onChange={set("adSquareHtml")} rows={3} className={`${field} font-mono text-xs`} />
          </label>

          <p className="mt-2 border-t border-line pt-3 text-sm font-semibold">English site</p>
          {([
            ["adBannerHtmlEn", "Banner, 970 x 90"],
            ["adSquareHtmlEn", "Square, 300 x 250"],
            ["adHomeHtmlEn", "Home page slot"],
            ["adArticleHtmlEn", "Article page slot"],
            ["adSectionHtmlEn", "Section page slot"],
          ] as const).map(([name, label]) => (
            <label key={name} className="grid gap-1 text-sm">
              <span className="text-xs font-medium text-ink-soft">{label}</span>
              <textarea
                name={name}
                value={form[name]}
                onChange={set(name)}
                rows={3}
                className={`${field} font-mono text-xs`}
              />
            </label>
          ))}
        </div>
        </details>
      </section>

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save site settings"}
      </button>
    </form>
  );
}
