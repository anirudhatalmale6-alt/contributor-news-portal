import type { Metadata } from "next";
import { Feed } from "@/components/public/feed";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "দ্য ডকুমেন্ট - পাঠকদের লেখা সংবাদ",
  alternates: { canonical: "/bn", languages: { en: "/", bn: "/bn" } },
};

export default async function BanglaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category = "All" } = await searchParams;
  return <Feed locale="BN" category={category} />;
}
