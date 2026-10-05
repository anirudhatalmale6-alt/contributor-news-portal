import type { Metadata } from "next";
import { ArticleView } from "@/components/public/article-view";
import { articleForLocale, publishedSlugs } from "@/lib/articles";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleForLocale("EN", slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.dek ?? undefined,
    alternates: {
      canonical: `/article/${slug}`,
      languages: {
        en: `/article/${slug}`,
        ...(article.counterpartHref ? { bn: article.counterpartHref } : {}),
      },
    },
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      images: article.coverImage ? [article.coverImage] : undefined,
      type: "article",
      locale: "en",
    },
  };
}

export async function generateStaticParams() {
  return (await publishedSlugs("EN")).map((slug) => ({ slug }));
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  return <ArticleView locale="EN" slug={slug} />;
}
