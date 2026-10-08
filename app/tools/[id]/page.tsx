import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import DiagnoseButton from "@/components/DiagnoseButton";
import { categoryName, categoryPath, jsonLd, NA, SITE_NAME, SITE_SHORT, SITE_URL, toolPath } from "@/lib/site";
import { getTool, getToolsByCategory } from "@/lib/tools-server";
import { PRICING, type Tool } from "@/lib/types";
import { validToolId } from "@/lib/security";

function trustedPlans(t: { confidence?: string | null; paid_plans?: { name: string; price_usd_month?: number | null; notes?: string | null }[] | null }) {
  if (t.confidence !== "high" && t.confidence !== "medium") return [];
  return (t.paid_plans || []).filter((p) => typeof p.price_usd_month === "number" && p.price_usd_month > 0 && !/需人工確認|未於官網即時確認/.test(p.notes ?? ""));
}


export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams() { return []; } // 全部於首次請求時產生並快取（ISR）

type Props = { params: Promise<{ id: string }> };
const W: Record<string, string> = { true: "是（使用第三方模型）", false: "否（自有模型）", partial: "部分使用第三方模型" };

async function load(id: string) {
  if (!validToolId(id)) return null;
  return getTool(id);
}

function metaDesc(t: Tool) {
  const plans = trustedPlans(t);
  const price = plans.length ? `付費方案約 $${Math.min(...plans.map((p) => p.price_usd_month as number))} 美元/月起` : t.pricing_model ? `計價模式：${PRICING[t.pricing_model] ?? t.pricing_model}` : "";
  return [`${t.name}：${t.description_zh ?? ""}`, price, `查看 ${t.name} 的價格、訂閱方案、免費額度與是否套殼。`].filter(Boolean).join(" ").slice(0, 155);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await load(id);
  if (!t) return { title: "找不到此工具", robots: { index: false } };
  const title = `${t.name} 價格、方案與評價`;
  const description = metaDesc(t);
  const url = toolPath(t.id);
  return {
    title, description, alternates: { canonical: url },
    openGraph: { type: "article", title: `${title} | ${SITE_SHORT}`, description, url, siteName: SITE_NAME, locale: "zh_TW", images: [{ url: "/logo.png", alt: SITE_NAME }] },
    twitter: { card: "summary", title: `${title} | ${SITE_SHORT}`, description, images: ["/logo.png"] },
  };
}

export default async function ToolPage({ params }: Props) {
  const { id } = await params;
  const t = await load(id);
  if (!t) notFound();
  const related = (await getToolsByCategory(t.category, 13).catch(() => [])).filter((x) => x.id !== t.id).slice(0, 12);
  const priced = trustedPlans(t);
  const cat = categoryName(t.category);
  const pageUrl = SITE_URL + toolPath(t.id);

  const ld = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication",
      name: t.name, url: pageUrl, sameAs: t.url, description: t.description_zh ?? undefined,
      applicationCategory: cat, operatingSystem: t.platforms?.length ? t.platforms.join(", ") : "Web",
      ...(t.company ? { publisher: { "@type": "Organization", name: t.company } } : {}),
      ...(priced.length ? { offers: priced.map((p) => ({ "@type": "Offer", name: p.name, price: p.price_usd_month, priceCurrency: "USD", url: t.pricing_url ?? t.url })) } : {}),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "首頁", item: SITE_URL + "/" },
        { "@type": "ListItem", position: 2, name: cat, item: SITE_URL + categoryPath(t.category) },
        { "@type": "ListItem", position: 3, name: t.name, item: pageUrl },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-3xl p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumb items={[{ name: "首頁", href: "/" }, { name: cat, href: categoryPath(t.category) }, { name: t.name }]} />
      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{t.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          <Link href={categoryPath(t.category)} className="rounded bg-indigo-50 px-2 py-0.5 hover:underline">{cat}</Link>
          {t.subcategory && <span className="rounded bg-slate-100 px-2 py-0.5">{t.subcategory}</span>}
          {t.pricing_model && <span className="rounded bg-emerald-50 px-2 py-0.5">{PRICING[t.pricing_model] ?? t.pricing_model}</span>}
        </div>
        <p className="mt-3 text-slate-700">{t.description_zh || NA}</p>
        {t.key_features?.length ? <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">{t.key_features.map((f, i) => <li key={i}>{f}</li>)}</ul> : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <DiagnoseButton tool={t} />
          <a href={t.url} target="_blank" rel="nofollow noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">前往官網 ↗</a>
        </div>

        <h2 className="mt-6 border-b pb-1 text-lg font-semibold">價格與方案</h2>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">計價模式</dt><dd>{t.pricing_model ? PRICING[t.pricing_model] ?? t.pricing_model : NA}</dd>
          <dt className="text-slate-500">付費方案</dt>
          <dd>{t.paid_plans?.length ? <ul className="list-disc pl-5">{t.paid_plans.map((p, i) => <li key={i}>{p.name}：{p.price_usd_month != null ? `US$${p.price_usd_month}/月` : NA}{p.notes ? <span className="text-xs text-slate-400">（{p.notes}）</span> : null}</li>)}</ul> : NA}</dd>
          <dt className="text-slate-500">免費方案</dt><dd>{t.free_tier || NA}</dd>
          <dt className="text-slate-500">價格頁</dt><dd>{t.pricing_url ? <a href={t.pricing_url} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-indigo-600 hover:underline">{t.pricing_url}</a> : NA}</dd>
        </dl>

        <h2 className="mt-6 border-b pb-1 text-lg font-semibold">模型與技術</h2>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">是否套殼</dt><dd>{(t.is_wrapper && W[t.is_wrapper]) || NA}</dd>
          <dt className="text-slate-500">底層模型</dt><dd>{t.underlying_models || NA}</dd>
          <dt className="text-slate-500">公司</dt><dd>{t.company || NA}{t.country ? `（${t.country}）` : ""}</dd>
          <dt className="text-slate-500">最後核實</dt><dd>{t.last_verified || "未核實"}</dd>
        </dl>

        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ 本頁資料由公開網頁自動整理，價格與方案可能已變動，請以官網為準；「AI 即時診斷」為 AI 自動分析，僅供參考。
        </p>
      </article>

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">其他{cat}工具</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
                <Link href={toolPath(r.id)} className="font-medium text-indigo-700 hover:underline">{r.name}</Link>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.description_zh}</p>
              </li>
            ))}
          </ul>
          <Link href={categoryPath(t.category)} className="mt-3 inline-block text-sm text-indigo-600 hover:underline">查看全部{cat}工具 →</Link>
        </section>
      )}
    </main>
  );
}
