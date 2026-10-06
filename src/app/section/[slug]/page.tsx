import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SectionPage } from "@/components/public/section";
import { categoryFromSlug, t } from "@/lib/i18n";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) return { title: "বিভাগ পাওয়া যায়নি" };
  const name = t("BN").sections[category] ?? category;
  return {
    title: t("BN").inSection(name),
    alternates: {
      canonical: `/section/${slug}`,
      languages: { bn: `/section/${slug}`, en: `/en/section/${slug}` },
    },
  };
}

export default async function BanglaSection({ params }: Props) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();
  return <SectionPage locale="BN" category={category} />;
}
