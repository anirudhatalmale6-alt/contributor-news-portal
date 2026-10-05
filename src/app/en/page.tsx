import type { Metadata } from "next";
import { Feed } from "@/components/public/feed";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "The Document - contributor-powered news",
  alternates: { canonical: "/en", languages: { bn: "/", en: "/en" } },
};

export default async function EnglishHomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "All" } = await searchParams;
  return <Feed locale="EN" category={category} />;
}
