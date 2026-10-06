import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isOwner, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { PeopleTable } from "./people-table";
import { paymentSettings } from "@/lib/settings";
import { maskedDestination, methodLabel } from "@/lib/payout";

export const metadata = { title: "People" };

/**
 * Everyone with an account, searchable by name or email, with the role controls
 * each staff member is allowed to use.
 */
export default async function PeoplePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/dashboard");

  const [users, settings, sums] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        createdAt: true,
        accounts: { select: { provider: true } },
        payout: {
          select: { method: true, walletNumber: true, accountNumber: true, email: true },
        },
        _count: { select: { articles: true } },
      },
    }),
    paymentSettings(),
    prisma.article.groupBy({
      by: ["authorId"],
      where: { status: "APPROVED" },
      _sum: { payoutCents: true },
    }),
  ]);
  const earned = new Map(sums.map((s) => [s.authorId, s._sum.payoutCents ?? 0]));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="people" />
        </div>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">People</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {isOwner(user.role)
            ? "Everyone with an account. You can set any role, including other owners."
            : "Everyone with an account. You can make a contributor an editor, and put an editor back."}
        </p>

        <PeopleTable
          currency={settings.currency}
          meId={user.id}
          myRole={user.role}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            tier: u.tier,
            providers: u.accounts.map((a) => a.provider),
            hasPayout: Boolean(u.payout),
            payoutMethod: u.payout ? methodLabel(u.payout.method) : null,
            payoutMasked: u.payout ? maskedDestination(u.payout) : "",
            articles: u._count.articles,
            earnedCents: earned.get(u.id) ?? 0,
          }))}
        />
      </main>
    </>
  );
}
