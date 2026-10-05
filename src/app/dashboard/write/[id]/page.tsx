import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/rbac";
import { SiteHeader } from "@/components/site-header";
import { Composer } from "./composer";

export const metadata = { title: "Write" };

export default async function WritePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      media: { orderBy: { createdAt: "asc" } },
      translations: { include: { translator: { select: { id: true, role: true } } } },
      reviews: {
        where: { action: { in: ["APPROVED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { editor: { select: { name: true } } },
      },
    },
  });
  if (!article) notFound();
  if (article.authorId !== user.id) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-20">
        <Link
          href="/dashboard"
          className="inline-block py-4 text-sm text-ink-soft hover:text-ink"
        >
          &larr; Back to my desk
        </Link>
        <Composer
          article={{
            id: article.id,
            title: article.title,
            dek: article.dek ?? "",
            body: article.body,
            category: article.category,
            language: article.language,
            status: article.status,
            coverImage: article.coverImage,
            slug: article.slug,
            media: article.media.map((m) => ({
              id: m.id,
              kind: m.kind,
              url: m.url,
              caption: m.caption,
            })),
          }}
          secondVersion={(() => {
            const other = article.language === "EN" ? "BN" : "EN";
            const tr = article.translations.find((t) => t.locale === other);
            return tr
              ? {
                  title: tr.title,
                  dek: tr.dek ?? "",
                  body: tr.body,
                  byEditor: tr.translator ? tr.translator.id !== user.id : false,
                }
              : null;
          })()}
          lastNote={
            article.reviews[0]
              ? {
                  action: article.reviews[0].action,
                  note: article.reviews[0].note ?? "",
                  editor: article.reviews[0].editor?.name ?? "The desk",
                }
              : null
          }
        />
      </main>
    </>
  );
}
