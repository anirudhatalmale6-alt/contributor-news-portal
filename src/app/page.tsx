import type { Metadata } from "next";
import { Feed } from "@/components/public/feed";

// Cached HTML, revalidated every 60s - a visitor is not waiting on a database.
export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: "/", languages: { en: "/", bn: "/bn" } },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "All" } = await searchParams;
  return <Feed locale="EN" category={category} />;
}
