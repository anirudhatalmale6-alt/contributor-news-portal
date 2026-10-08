import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isAdmin, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { paymentSettings } from "@/lib/settings";
import { methodLabel } from "@/lib/payout";
import { money } from "@/lib/format";
import { localeDate } from "@/lib/i18n";
import { PayoutBoard } from "./payout-board";

export const metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

/**
 * Who is waiting to be paid.
 *
 * Admin and above only. An editor commissions and publishes; they have no
 * business seeing a contributor's bank account, and that rule is the same here
 * as it is on the people list.
 */
export default async function PayoutsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect(isStaff(user.role) ? "/people" : "/dashboard");

  const [settings, pending, recent] = await Promise.all([
    paymentSettings(),
    prisma.payoutRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, payout: { select: { updatedAt: true } } } } },
    }),
    prisma.payoutRequest.findMany({
      where: { status: { in: ["PAID", "DECLINED"] } },
      orderBy: { decidedAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, name: true } },
        decidedBy: { select: { name: true } },
      },
    }),
  ]);

  const owed = pending.reduce((sum, r) => sum + r.amountCents, 0);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="payouts" />
        </div>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Payouts</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Contributors ask to be paid once they have earned{" "}
          {money(settings.minPayoutCents, settings.currency)} or more. Send the money yourself by
          bKash, Nagad or bank transfer, then mark it paid here so the amount comes off what they
          are owed. Nothing on this site moves money on its own.
        </p>

        <p className="mt-4 rounded-xl border border-line bg-paper-soft px-4 py-3 text-sm">
          <span className="font-medium">{pending.length}</span> waiting ·{" "}
          <span className="font-medium tabular-nums">{money(owed, settings.currency)}</span> in
          total
        </p>

        <div className="mt-4">
          <PayoutBoard
            requests={pending.map((r) => ({
              id: r.id,
              who: r.user.name,
              whoId: r.user.id,
              amount: money(r.amountCents, settings.currency),
              method: methodLabel(r.method),
              accountName: r.accountName,
              destination: r.destination,
              note: r.note,
              asked: localeDate(r.createdAt, "EN"),
              // The details on the request are a snapshot. If the profile has
              // moved since, the person paying has to know before they send.
              changedSince:
                r.user.payout?.updatedAt && r.user.payout.updatedAt > r.createdAt
                  ? localeDate(r.user.payout.updatedAt, "EN")
                  : null,
            }))}
          />
        </div>

        {recent.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">
              Already answered
            </h2>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "PAID"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    {r.status === "PAID" ? "Paid" : "Declined"}
                  </span>
                  <span className="font-medium">{r.user.name}</span>
                  <span className="tabular-nums">{money(r.amountCents, settings.currency)}</span>
                  <span className="text-ink-soft">
                    {r.decidedAt ? localeDate(r.decidedAt, "EN") : ""}
                    {r.decidedBy ? ` · by ${r.decidedBy.name}` : ""}
                  </span>
                  {r.decidedNote ? (
                    <span className="w-full text-ink-soft">{r.decidedNote}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
