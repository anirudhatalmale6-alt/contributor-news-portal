import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, isAdmin, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { PagesEditor } from "./pages-editor";

export const metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

/** The owner's own pages - About us, Contact, Privacy policy - and the footer links to them. */
export default async function PagesScreen() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user.role)) redirect(isStaff(user.role) ? "/people" : "/dashboard");

  const pages = await prisma.page.findMany({ orderBy: [{ footerOrder: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="pages" />
        </div>
        <div className="border-b border-line py-6">
          <h1 className="font-serif text-2xl font-bold sm:text-3xl">Pages</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Your own pages, such as About us, Contact, Privacy policy or Advertise with us. Write each
            in Bangla and English. Tick &quot;Show in footer&quot; and it is linked at the bottom of
            every page on both sites, in the order you set.
          </p>
        </div>
        <PagesEditor
          initial={pages.map((p) => ({
            id: p.id,
            slug: p.slug,
            titleBn: p.titleBn,
            titleEn: p.titleEn,
            bodyBn: p.bodyBn,
            bodyEn: p.bodyEn,
            published: p.published,
            inFooter: p.inFooter,
            footerOrder: p.footerOrder,
          }))}
        />
      </main>
    </>
  );
}
