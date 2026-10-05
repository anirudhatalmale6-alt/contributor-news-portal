import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { PayoutForm } from "./payout-form";

export const metadata = { title: "Payment details" };

export default async function PayoutPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const payout = await prisma.payoutProfile.findUnique({ where: { userId: user.id } });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 pb-20">
        <Link href="/dashboard" className="inline-block py-4 text-sm text-ink-soft hover:text-ink">
          &larr; Back to my desk
        </Link>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Payment details</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Where your payouts should be sent. Only you and the admin who sends the money can see
          these details - editors never see them, even though they set the amounts.
        </p>

        <div className="mt-6">
          <PayoutForm
            initial={
              payout
                ? {
                    method: payout.method,
                    accountName: payout.accountName,
                    walletNumber: payout.walletNumber ?? "",
                    bankName: payout.bankName ?? "",
                    branch: payout.branch ?? "",
                    accountNumber: payout.accountNumber ?? "",
                    routingNumber: payout.routingNumber ?? "",
                    email: payout.email ?? "",
                    country: payout.country,
                    note: payout.note ?? "",
                  }
                : null
            }
            updatedAt={payout?.updatedAt?.toISOString() ?? null}
          />
        </div>
      </main>
    </>
  );
}
