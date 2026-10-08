import type { Metadata } from "next";
import CategoryView, { categoryMetadata } from "@/components/views/CategoryView";

export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; } // 首次請求時產生並快取，建置時不需連線 Supabase

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return categoryMetadata((await params).slug, "en");
}

export default async function CategoryPage({ params }: Props) {
  return <CategoryView slug={(await params).slug} locale="en" />;
}
