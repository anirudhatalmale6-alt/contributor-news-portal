import Link from "next/link";
import { redirect } from "next/navigation";
import { socialProviders } from "@/auth";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { SocialButtons } from "@/components/auth-buttons";
import { LoginForm } from "./login-form";
import { text } from "@/lib/ui-text";
import type { Locale } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

/**
 * A reader signing in from the Bangla paper should not land on an English
 * page. The link that brought them here carries ?lang=bn, and everything on
 * this page - the menu above it included - follows that.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const { lang } = await searchParams;
  const locale: Locale = lang === "bn" ? "BN" : "EN";
  const s = (key: string) => text(key, locale);

  return (
    <>
      <SiteHeader locale={locale} />
      <main lang={locale === "BN" ? "bn" : "en"} className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">{s("auth.signInTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{s("auth.signInSub")}</p>

        <div className="mt-6 grid gap-4">
          <SocialButtons providers={socialProviders} />
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" />
            {s("auth.orWithEmail")}
            <span className="h-px flex-1 bg-line" />
          </div>
          <LoginForm />
        </div>

        <p className="mt-4 text-sm">
          <Link href={`/forgot${locale === "BN" ? "?lang=bn" : ""}`} className="text-ink-soft hover:text-ink">
            {s("auth.forgot")}
          </Link>
        </p>

        <p className="mt-6 text-sm text-ink-soft">
          {s("auth.noAccount")}{" "}
          <Link
            href={`/register${locale === "BN" ? "?lang=bn" : ""}`}
            className="font-medium text-brand hover:underline"
          >
            {s("auth.createOne")}
          </Link>
        </p>

        {/* The demo accounts include an owner, and their password is printed
            here. That is fine on a laptop and unacceptable on a public site, so
            it only appears when SHOW_DEMO_LOGINS is deliberately switched on. */}
        {process.env.SHOW_DEMO_LOGINS === "true" ? (
          <div className="mt-8 rounded-xl border border-line bg-paper-soft p-4 text-xs text-ink-soft">
            <p className="font-medium text-ink">Demo logins (password: demo1234)</p>
            <ul className="mt-2 grid gap-1">
              <li>admin@thedocument.test - Owner (site settings)</li>
              <li>editor@thedocument.test - Editor (newsroom only)</li>
              <li>maya@thedocument.test - Verified contributor</li>
              <li>sam@thedocument.test - General contributor</li>
            </ul>
          </div>
        ) : null}
      </main>
    </>
  );
}
