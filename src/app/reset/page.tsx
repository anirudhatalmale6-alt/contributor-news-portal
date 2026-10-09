import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { userForToken } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";
import type { Locale } from "@/lib/i18n";

export const metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; lang?: string }>;
}) {
  const { token, lang } = await searchParams;
  const locale: Locale = lang === "bn" ? "BN" : "EN";
  const bn = locale === "BN";
  // Checked here as well as on save, so a dead link says so immediately
  // instead of after somebody has typed a password twice.
  const found = token ? await userForToken(token) : null;

  return (
    <>
      <SiteHeader locale={locale} />
      <main lang={bn ? "bn" : "en"} className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">
          {bn ? "নতুন পাসওয়ার্ড দিন" : "Set a new password"}
        </h1>

        {found ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              {bn ? `${found.user.name}-এর অ্যাকাউন্টের জন্য।` : `For ${found.user.name}'s account.`}
            </p>
            <div className="mt-6">
              <ResetForm token={token!} locale={locale} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {bn
                ? "এই লিংকটি আগেই ব্যবহার করা হয়েছে বা মেয়াদ শেষ হয়ে গেছে। নতুন একটি চেয়ে নিন।"
                : "That link has been used already or has expired. Ask for a new one."}
            </p>
            <p className="mt-4 text-sm">
              <Link
                href={bn ? "/forgot?lang=bn" : "/forgot"}
                className="font-medium text-brand hover:underline"
              >
                {bn ? "নতুন লিংক চান" : "Send me a new link"}
              </Link>
            </p>
          </>
        )}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
