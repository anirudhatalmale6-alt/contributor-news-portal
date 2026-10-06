import { AuthorPage } from "@/components/public/author-page";

export const dynamic = "force-dynamic";

export default async function BanglaAuthor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthorPage locale="BN" id={id} />;
}
