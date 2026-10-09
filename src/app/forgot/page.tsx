import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ForgotForm } from "./forgot-form";
import type { Locale } from "@/lib/i18n";

export const metadata = { title: "Forgotten password" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale: Locale = lang === "bn" ? "BN" : "EN";
  const bn = locale === "BN";

  return (
    <>
      <SiteHeader locale={locale} />
      <main lang={bn ? "bn" : "en"} className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">
          {bn ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgotten your password?"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {bn
            ? "আপনার অ্যাকাউন্টের ইমেইল ঠিকানাটি লিখুন। নতুন পাসওয়ার্ড দেওয়ার একটি লিংক আমরা পাঠাব।"
            : "Type the email address on your account. We will send you a link to set a new password."}
        </p>

        <div className="mt-6">
          <ForgotForm locale={locale} />
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          <Link href={bn ? "/login?lang=bn" : "/login"} className="font-medium text-brand hover:underline">
            {bn ? "সাইন ইন পাতায় ফিরে যান" : "Back to sign in"}
          </Link>
        </p>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
