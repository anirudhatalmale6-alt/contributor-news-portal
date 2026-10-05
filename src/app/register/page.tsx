import Link from "next/link";
import { redirect } from "next/navigation";
import { socialProviders } from "@/auth";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { SocialButtons } from "@/components/auth-buttons";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Become a contributor" };

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Write for The Document</h1>
        <p className="mt-1 text-sm text-ink-soft">
          New accounts start as General Contributors. Publish well and an editor can flag you as a
          Verified Contributor.
        </p>

        <div className="mt-6 grid gap-4">
          <SocialButtons providers={socialProviders} />
          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>
          <RegisterForm />
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          Already a contributor?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </main>
    </>
  );
}
