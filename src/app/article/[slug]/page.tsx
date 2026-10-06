import type { Metadata } from "next";
import { ArticleView } from "@/components/public/article-view";
import { articleForLocale } from "@/lib/articles";

// The header reads the session cookie, which makes this page dynamic. Trying to
// prerender it throws DYNAMIC_SERVER_USAGE at runtime, so say so explicitly.
// (The next commit moves the session out of the header and restores caching.)
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleForLocale("BN", slug);
  if (!article) return { title: "লেখাটি পাওয়া যায়নি" };
  return {
    title: article.title,
    description: article.dek ?? undefined,
    alternates: {
      canonical: `/article/${slug}`,
      languages: {
        bn: `/article/${slug}`,
        ...(article.counterpartHref ? { en: article.counterpartHref } : {}),
      },
    },
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      images: article.coverImage ? [article.coverImage] : undefined,
      type: "article",
      locale: "bn",
    },
  };
}

export default async function BanglaArticlePage({ params }: Props) {
  const { slug } = await params;
  return <ArticleView locale="BN" slug={slug} />;
}
