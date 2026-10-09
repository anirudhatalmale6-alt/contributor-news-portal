import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { TierBadge } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, accounts: { select: { provider: true } } },
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-20">
        <Link
          href={user.role === "CONTRIBUTOR" ? "/dashboard" : "/editorial"}
          className="inline-block py-4 text-sm text-ink-soft hover:text-ink"
        >
          &larr; Back
        </Link>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Account</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span>{user.name}</span>
          <TierBadge tier={user.tier} role={user.role} />
          <span>{user.email}</span>
          {account?.accounts.length ? (
            <span>signed in with {account.accounts.map((a) => a.provider).join(", ")}</span>
          ) : null}
        </div>

        {/* The three things people actually come to this page looking for, and
            could not reach from here before. */}
        <nav className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/dashboard/profile"
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
          >
            Update public profile
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
          >
            Earnings dashboard
          </Link>
          <Link
            href="/inbox"
            className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-paper-soft"
          >
            Contact the editors
          </Link>
        </nav>

        <div className="mt-6">
          <PasswordForm hasPassword={Boolean(account?.passwordHash)} />
        </div>
      </main>
    </>
  );
}
