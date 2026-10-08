import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { FrontPageBoard } from "./front-page-board";
import { planFrontPage } from "@/lib/front-page";

export const metadata = { title: "Front page" };
export const dynamic = "force-dynamic";

/** Arranging the front page by hand, position by position. */
export default async function FrontPagePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/dashboard");

  const published = await prisma.article.findMany({
    where: { status: "APPROVED" },
    orderBy: [{ publishedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      category: true,
      coverImage: true,
      publishedAt: true,
      homeSlot: true,
      homeOrder: true,
      featured: true,
      featuredAt: true,
      language: true,
      translations: { select: { locale: true } },
      author: { select: { name: true } },
    },
  });

  const shape = (a: (typeof published)[number]) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    coverImage: a.coverImage,
    author: a.author.name,
    publishedAt: a.publishedAt?.toISOString() ?? null,
    homeSlot: a.homeSlot,
  });

  // What the Bangla front page will do with the positions nobody pinned,
  // worked out with the same function the page itself uses. Shown on the board
  // so the desk can see the automatic fill without going and looking at it.
  const onBanglaPage = published.filter(
    (a) => a.language === "BN" || a.translations.some((t) => t.locale === "BN"),
  );
  const pinnedBySlot = new Map<string, ReturnType<typeof shape>[]>();
  for (const a of onBanglaPage
    .filter((a) => a.homeSlot)
    .sort((x, y) => x.homeOrder - y.homeOrder)) {
    const slot = a.homeSlot as string;
    pinnedBySlot.set(slot, [...(pinnedBySlot.get(slot) ?? []), shape(a)]);
  }
  const { automatic } = planFrontPage({
    featured: onBanglaPage
      .filter((a) => a.featured)
      .sort((x, y) => (y.featuredAt?.getTime() ?? 0) - (x.featuredAt?.getTime() ?? 0))
      .map(shape),
    latest: onBanglaPage.map(shape),
    pinned: pinnedBySlot,
    key: (p) => p.id,
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 pb-20">
        <div className="pt-4">
          <StaffNav user={user} current="frontpage" />
        </div>

        <h1 className="font-serif text-2xl font-bold sm:text-3xl">Front page</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Choose what sits where. Anything you leave empty fills itself with the newest published
          work - and each position below shows you exactly which pieces that will be, in order.{" "}
          <Link href="/" className="font-medium text-brand hover:underline">
            See the front page
          </Link>
        </p>

        <div className="mt-6">
          <FrontPageBoard
            pinned={published.filter((a) => a.homeSlot).map(shape)}
            pool={published.map(shape)}
            automatic={automatic}
          />
        </div>
      </main>
    </>
  );
}
