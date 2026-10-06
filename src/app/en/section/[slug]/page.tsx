import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/public/section";
import { categoryFromSlug, t } from "@/lib/i18n";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return { title: "Section not found" };
  return {
    title: t("EN").inSection(category),
    alternates: {
      canonical: `/en/section/${slug}`,
      languages: { en: `/en/section/${slug}`, bn: `/section/${slug}` },
    },
  };
}

export default async function EnglishSection({ params }: Props) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();
  return <SectionPage locale="EN" category={category} />;
}
