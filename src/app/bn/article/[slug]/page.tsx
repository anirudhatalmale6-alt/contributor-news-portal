import type { Metadata } from "next";
import { ArticleView } from "@/components/public/article-view";
import { articleForLocale, publishedSlugs } from "@/lib/articles";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleForLocale("BN", slug);
  if (!article) return { title: "লেখাটি পাওয়া যায়নি" };
  return {
    title: article.title,
    description: article.dek ?? undefined,
    alternates: {
      canonical: `/bn/article/${slug}`,
      languages: {
        bn: `/bn/article/${slug}`,
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

export async function generateStaticParams() {
  return (await publishedSlugs("BN")).map((slug) => ({ slug }));
}

export default async function BanglaArticlePage({ params }: Props) {
  const { slug } = await params;
  return <ArticleView locale="BN" slug={slug} />;
}
