import { redirect } from "next/navigation";
import { currentUser, isOwner, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { TEXT_DEFAULTS, TEXT_GROUPS } from "@/lib/text-defaults";
import { currentOverrides } from "@/lib/ui-text";
import { primeUiText } from "@/lib/ui-text-store";
import { WordingEditor } from "./wording-editor";

export const metadata = { title: "Wording" };
export const dynamic = "force-dynamic";

/** Every label on the site, in both languages, editable without a developer. */
export default async function WordingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isOwner(user.role)) redirect(isStaff(user.role) ? "/people" : "/dashboard");

  await primeUiText(true);
  const overrides = currentOverrides();

  const lines = Object.entries(TEXT_DEFAULTS).map(([key, entry]) => ({
    key,
    group: entry.group,
    note: entry.note ?? "",
    shipped: { EN: entry.en, BN: entry.bn },
    value: { EN: overrides[`EN:${key}`] ?? "", BN: overrides[`BN:${key}`] ?? "" },
  }));

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="wording" />
        </div>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Wording</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-soft">
          Every label, button and message on the site, in both languages. The grey text in each box
          is what the site came with - type over it to use your own words, and empty the box again
          to go back. Changes appear on the site as soon as you save.
        </p>

        <div className="mt-6">
          <WordingEditor lines={lines} groups={[...TEXT_GROUPS]} />
        </div>
      </main>
    </>
  );
}
