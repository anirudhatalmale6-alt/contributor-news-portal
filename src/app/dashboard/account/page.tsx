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

        <div className="mt-6">
          <PasswordForm hasPassword={Boolean(account?.passwordHash)} />
        </div>
      </main>
    </>
  );
}
