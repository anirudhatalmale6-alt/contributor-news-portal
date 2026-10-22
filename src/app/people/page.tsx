import { DeskShell } from "@/components/desk-shell";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isOwner, isStaff } from "@/lib/rbac";
import { PeopleTable } from "./people-table";
import { paymentSettings } from "@/lib/settings";
import { earningsByUser } from "@/lib/earnings";
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

  const [users, settings, earned] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tier: true,
        createdAt: true,
        suspendedAt: true,
        phone: true,
        whatsapp: true,
        phonePublic: true,
        accounts: { select: { provider: true } },
        payout: {
          select: { method: true, walletNumber: true, accountNumber: true, email: true },
        },
        _count: { select: { articles: true } },
      },
    }),
    paymentSettings(),
    earningsByUser(),
  ]);

  return (
    <>
      <DeskShell user={user} current="people" width="max-w-7xl">

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">People</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {isOwner(user.role)
            ? "Everyone with an account. You can set any role, including other owners."
            : "Everyone with an account. You can make a contributor an editor, and put an editor back."}
        </p>

        <p className="mt-1 text-sm text-ink-soft">
          Contact numbers are for the newsroom. A reader sees one only if that
          contributor has chosen to publish it.
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
            suspended: Boolean(u.suspendedAt),
            phone: u.phone ?? "",
            whatsapp: u.whatsapp ?? "",
            phonePublic: u.phonePublic,
            payoutMethod: u.payout ? methodLabel(u.payout.method) : null,
            payoutMasked: u.payout ? maskedDestination(u.payout) : "",
            articles: u._count.articles,
            earnedCents: earned.get(u.id)?.totalCents ?? 0,
          }))}
        />
      </DeskShell>
    </>
  );
}
