import { CustomPage, customPageMeta } from "@/components/public/custom-page";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return customPageMeta("EN", slug);
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <CustomPage locale="EN" slug={slug} />;
}
