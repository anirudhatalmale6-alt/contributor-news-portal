import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isAdmin, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { primeUiText } from "@/lib/ui-text-store";
import { allSections } from "@/lib/sections";
import { t } from "@/lib/i18n";
import { siteSettings } from "@/lib/settings";
import { SectionsEditor } from "./sections-editor";

export const metadata = { title: "Sections" };
export const dynamic = "force-dynamic";

/** The paper's sections: names, order, web addresses, the menu, and adding or removing them. */
export default async function SectionsScreen() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect(isStaff(user.role) ? "/people" : "/dashboard");

  await primeUiText(true);
  const [counts, site] = await Promise.all([
    prisma.article.groupBy({ by: ["category"], _count: { _all: true } }),
    siteSettings(),
  ]);
  const countFor = (key: string) => counts.find((c) => c.category === key)?._count._all ?? 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="sections" />
        </div>
        <div className="border-b border-line py-6">
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Sections</h1>
          <p className="mt-1 text-sm text-ink-soft">
            The sections of the paper and the menu across the top of both sites. Rename them, change
            the order with the arrows, hide one from the menu, add new ones, or remove one by moving
            its articles somewhere else first.
          </p>
        </div>
        <SectionsEditor
          initial={allSections().map((s) => ({
            key: s.key,
            slug: s.slug,
            inMenu: s.inMenu,
            en: t("EN").sections[s.key] ?? s.key,
            bn: t("BN").sections[s.key] ?? s.key,
            articles: countFor(s.key),
          }))}
          limits={{ left: site.maxSectionRail, list: site.maxSectionGrid }}
        />
      </main>
    </>
  );
}
