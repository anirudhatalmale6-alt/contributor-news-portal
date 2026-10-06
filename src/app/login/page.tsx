import Link from "next/link";
import { redirect } from "next/navigation";
import { socialProviders } from "@/auth";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { SocialButtons } from "@/components/auth-buttons";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Back to your drafts, submissions and earnings.
        </p>

        <div className="mt-6 grid gap-4">
          <SocialButtons providers={socialProviders} />
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
          <LoginForm />
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Create one
          </Link>
        </p>

        <div className="mt-8 rounded-xl border border-line bg-paper-soft p-4 text-xs text-ink-soft">
          <p className="font-medium text-ink">Demo logins (password: demo1234)</p>
          <ul className="mt-2 grid gap-1">
            <li>admin@thedocument.test - Owner (site settings)</li>
            <li>editor@thedocument.test - Editor (newsroom only)</li>
            <li>maya@thedocument.test - Verified contributor</li>
            <li>sam@thedocument.test - General contributor</li>
          </ul>
        </div>
      </main>
    </>
  );
}
