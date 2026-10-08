import type { Metadata } from "next";
import ToolView, { toolMetadata } from "@/components/views/ToolView";

export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; } // 全部於首次請求時產生並快取（ISR）

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return toolMetadata((await params).id, "en");
}

export default async function ToolPage({ params }: Props) {
  return <ToolView id={(await params).id} locale="en" />;
}
