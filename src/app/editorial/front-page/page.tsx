import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentUser, isStaff } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { StaffNav } from "@/components/staff-nav";
import { FrontPageBoard } from "./front-page-board";

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
          work, so you can plan the top of the page and let the rest look after itself.{" "}
          <Link href="/" className="font-medium text-brand hover:underline">
            See the front page
          </Link>
        </p>

        <div className="mt-6">
          <FrontPageBoard
            pinned={published.filter((a) => a.homeSlot).map(shape)}
            pool={published.map(shape)}
          />
        </div>
      </main>
    </>
  );
}
