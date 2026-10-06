import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AuthorPage } from "@/components/public/author-page";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function authorMeta(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { name: true, bio: true, image: true, suspendedAt: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const author = await authorMeta(id);
  if (!author || author.suspendedAt) return { title: "Writer not found" };
  return {
    title: author.name,
    description: author.bio ?? undefined,
    alternates: { canonical: `/en/author/${id}`, languages: { en: `/en/author/${id}`, bn: `/author/${id}` } },
    openGraph: { title: author.name, description: author.bio ?? undefined, type: "profile" },
  };
}

export default async function EnglishAuthor({ params }: Props) {
  const { id } = await params;
  return <AuthorPage locale="EN" id={id} />;
}
