import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { CATEGORY_INTRO, categoryName, categoryPath, jsonLd, SITE_NAME, SITE_SHORT, SITE_URL, toolPath } from "@/lib/site";
import { getToolsByCategory } from "@/lib/tools-server";
import { CATEGORIES, PRICING } from "@/lib/types";

export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; } // 首次請求時產生並快取，建置時不需連線 Supabase

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!CATEGORIES[slug]) return { title: "找不到此分類", robots: { index: false } };
  const name = categoryName(slug);
  const title = `${name} AI 工具推薦與價格比較`;
  const description = `${CATEGORY_INTRO[slug] ?? ""} 收錄於 ${SITE_NAME}。`.slice(0, 155);
  return {
    title, description, alternates: { canonical: categoryPath(slug) },
    openGraph: { type: "website", title: `${title} | ${SITE_SHORT}`, description, url: categoryPath(slug), siteName: SITE_NAME, locale: "zh_TW", images: [{ url: "/logo.png", alt: SITE_NAME }] },
    twitter: { card: "summary", title: `${title} | ${SITE_SHORT}`, description, images: ["/logo.png"] },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  if (!CATEGORIES[slug]) notFound();
  const tools = await getToolsByCategory(slug); // 連線失敗時丟出例外，不會把空清單快取
  const name = categoryName(slug);
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "首頁", item: SITE_URL + "/" },
      { "@type": "ListItem", position: 2, name, item: SITE_URL + categoryPath(slug) } ] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `${name} AI 工具`, numberOfItems: tools.length,
      itemListElement: tools.slice(0, 100).map((t, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + toolPath(t.id), name: t.name })) },
  ];
  return (
    <main className="mx-auto max-w-4xl p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumb items={[{ name: "首頁", href: "/" }, { name }]} />
      <h1 className="text-2xl font-bold">{name} AI 工具</h1>
      <p className="mt-2 text-slate-600">{CATEGORY_INTRO[slug]}</p>
      <p className="mt-1 text-sm text-slate-400">共 {tools.length} 個工具・價格與方案以官網為準</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <li key={t.id} className="rounded-xl bg-white p-4 shadow-sm">
            <Link href={toolPath(t.id)} className="font-semibold text-indigo-700 hover:underline">{t.name}</Link>
            {t.pricing_model && <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs">{PRICING[t.pricing_model] ?? t.pricing_model}</span>}
            <p className="mt-1 text-sm text-slate-600">{t.description_zh}</p>
          </li>
        ))}
      </ul>
      <nav className="mt-8">
        <h2 className="mb-2 font-semibold">其他分類</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.keys(CATEGORIES).filter((k) => k !== slug).map((k) => <Link key={k} href={categoryPath(k)} className="rounded-full bg-white px-3 py-1 shadow-sm hover:text-indigo-600">{categoryName(k)}</Link>)}
        </div>
      </nav>
    </main>
  );
}
