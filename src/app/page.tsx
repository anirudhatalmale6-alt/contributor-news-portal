import type { Metadata } from "next";
import { Feed } from "@/components/public/feed";

// Cached HTML, revalidated every 60s - a visitor is not waiting on a database.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "দ্য ডকুমেন্ট - পাঠকদের লেখা সংবাদ",
  alternates: { canonical: "/", languages: { bn: "/", en: "/en" } },
};

/** The default site is Bangla. English lives at /en. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "All" } = await searchParams;
  return <Feed locale="BN" category={category} />;
}
