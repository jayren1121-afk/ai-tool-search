import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import DiagnoseButton from "@/components/DiagnoseButton";
import HealthBadge from "@/components/HealthBadge";
import ToolCommunity from "@/components/ToolCommunity";
import VoteSummary from "@/components/VoteSummary";
import { jsonLd, langAlternates, siteName, SITE_SHORT, SITE_URL } from "@/lib/site";
import { getPublicStats, getTool, getHealthByCategory, getToolHealth, getToolsByCategory, type ToolFull } from "@/lib/tools-server";
import { validToolId } from "@/lib/security";
import {
  categoryHref, catName, HTML_LANG, lp, OG_LOCALE, pricingName, releaseText, t, toolDesc, toolFeatures, toolHref,
  trFree, trNote, trPlanName, trSub, type Locale,
} from "@/lib/i18n";

function trustedPlans(t: { confidence?: string | null; paid_plans?: { name: string; price_usd_month?: number | null; notes?: string | null }[] | null }) {
  if (t.confidence !== "high" && t.confidence !== "medium") return [];
  return (t.paid_plans || []).filter((p) => typeof p.price_usd_month === "number" && p.price_usd_month > 0 && !/需人工確認|未於官網即時確認/.test(p.notes ?? ""));
}

async function load(id: string, locale: Locale) {
  if (!validToolId(id)) return null;
  return getTool(id, locale);
}

function metaDesc(x: ToolFull, locale: Locale) {
  const plans = trustedPlans(x);
  const min = plans.length ? Math.min(...plans.map((p) => p.price_usd_month as number)) : null;
  const pm = pricingName(locale, x.pricing_model);
  if (locale === "en") {
    const price = min != null ? `Paid plans from about $${min}/month.` : pm ? `Pricing model: ${pm}.` : "";
    return [x.description_en?.trim() ? `${x.name}: ${x.description_en.trim()}` : toolDesc("en", x), price, `See ${x.name} pricing, plans, free tier.`].filter(Boolean).join(" ").slice(0, 160);
  }
  const price = min != null ? `付費方案約 $${min} 美元/月起` : pm ? `計價模式：${pm}` : "";
  return [`${x.name}：${x.description_zh ?? ""}`, price, `查看 ${x.name} 的價格、訂閱方案與免費額度。`].filter(Boolean).join(" ").slice(0, 155);
}

export async function toolMetadata(id: string, locale: Locale): Promise<Metadata> {
  const L = t(locale);
  const x = await load(id, locale);
  if (!x) return { title: L.toolNotFound, robots: { index: false } };
  const title = L.toolTitle(x.name);
  const description = metaDesc(x, locale);
  const alt = langAlternates(`/tools/${encodeURIComponent(x.id)}`, locale);
  return {
    title, description, alternates: alt, applicationName: siteName(locale),
    openGraph: { type: "article", title: `${title} | ${SITE_SHORT}`, description, url: alt.canonical, siteName: siteName(locale), locale: OG_LOCALE[locale], images: [{ url: "/logo.png", alt: siteName(locale) }] },
    twitter: { card: "summary", title: `${title} | ${SITE_SHORT}`, description, images: ["/logo.png"] },
  };
}

export default async function ToolView({ id, locale }: { id: string; locale: Locale }) {
  const L = t(locale); const NA = L.unknown;
  const x = await load(id, locale);
  if (!x) notFound();
  const [relatedAll, health] = await Promise.all([getToolsByCategory(x.category, 13, locale).catch(() => []), getToolHealth(x.id)]); // 官網檢查結果取不到時為 null（不顯示標籤）
  const related = relatedAll.filter((r) => r.id !== x.id).slice(0, 12);
  const priced = trustedPlans(x);
  const [ps, relHealth] = await Promise.all([getPublicStats([x.id, ...related.map((r) => r.id)], 86400), related.length ? getHealthByCategory(x.category, 200) : Promise.resolve({} as Awaited<ReturnType<typeof getHealthByCategory>>)]); // 同分類健康資料（與分類頁共用快取）；失敗為空物件
  const st = ps[x.id];
  const cat = catName(locale, x.category);
  const pageUrl = SITE_URL + toolHref(locale, x.id);
  const desc = toolDesc(locale, x);
  const features = toolFeatures(locale, x);
  const paren = (s: string) => (locale === "en" ? ` (${s})` : `（${s}）`);

  const ld = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", inLanguage: HTML_LANG[locale],
      name: x.name, url: pageUrl, sameAs: x.url, description: desc ?? undefined,
      applicationCategory: cat, operatingSystem: x.platforms?.length ? x.platforms.join(", ") : "Web",
      ...(x.company ? { publisher: { "@type": "Organization", name: x.company } } : {}),
      ...(st && st.review_count > 0 && st.rating_avg ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(st.rating_avg), reviewCount: st.review_count, bestRating: 5, worstRating: 1 } } : {}),
      ...(priced.length ? { offers: priced.map((p) => ({ "@type": "Offer", name: trPlanName(locale, p.name), price: p.price_usd_month, priceCurrency: "USD", url: x.pricing_url ?? x.url })) } : {}),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", inLanguage: HTML_LANG[locale],
      itemListElement: [
        { "@type": "ListItem", position: 1, name: L.home, item: SITE_URL + lp(locale, "/") },
        { "@type": "ListItem", position: 2, name: cat, item: SITE_URL + categoryHref(locale, x.category) },
        { "@type": "ListItem", position: 3, name: x.name, item: pageUrl },
      ],
    },
  ];

  return (
    <main className="mx-auto max-w-3xl p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumb locale={locale} items={[{ name: L.home, href: lp(locale, "/") }, { name: cat, href: categoryHref(locale, x.category) }, { name: x.name }]} />
      <article className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold">{x.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          <Link href={categoryHref(locale, x.category)} className="rounded bg-indigo-50 px-2 py-0.5 hover:underline">{cat}</Link>
          {x.subcategory && <span className="rounded bg-slate-100 px-2 py-0.5">{trSub(locale, x.subcategory)}</span>}
          {x.pricing_model && <span className="rounded bg-emerald-50 px-2 py-0.5">{pricingName(locale, x.pricing_model)}</span>}
        </div>
        {st && <VoteSummary up={st.up} down={st.down} className="mt-2" locale={locale} />}
        <HealthBadge health={health} locale={locale} full className="mt-2" />
        <p className="mt-3 text-slate-700">{desc || NA}</p>
        {features.length ? <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">{features.map((f, i) => <li key={i}>{f}</li>)}</ul> : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <DiagnoseButton tool={x} locale={locale} />
          <a href={x.url} target="_blank" rel="nofollow noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">{L.visitSite}</a>
        </div>

        <h2 className="mt-6 border-b pb-1 text-lg font-semibold">{L.pricingPlans}</h2>
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">{L.pricingModel}</dt><dd>{pricingName(locale, x.pricing_model) ?? NA}</dd>
          <dt className="text-slate-500">{L.paidPlans}</dt>
          <dd>{x.paid_plans?.length ? <ul className="list-disc pl-5">{x.paid_plans.map((p, i) => <li key={i}>{trPlanName(locale, p.name)}{locale === "en" ? ": " : "："}{p.price_usd_month != null ? `US$${p.price_usd_month}${L.perMonth}` : NA}{p.notes ? <span className="text-xs text-slate-400">{paren(trNote(locale, p.notes)!)}</span> : null}</li>)}</ul> : NA}</dd>
          <dt className="text-slate-500">{L.freeTier}</dt><dd>{trFree(locale, x.free_tier) || NA}</dd>
          <dt className="text-slate-500">{L.pricingPage}</dt><dd>{x.pricing_url ? <a href={x.pricing_url} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-indigo-600 hover:underline">{x.pricing_url}</a> : NA}</dd>
        </dl>

        <h2 className="mt-6 border-b pb-1 text-lg font-semibold">{L.modelTech}</h2>
        <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">{L.company}</dt><dd>{x.company || NA}{x.country ? paren(x.country) : ""}</dd>
          <dt className="text-slate-500">{L.lastVerified}</dt><dd>{x.last_verified || L.unverified}</dd>
          <dt className="text-slate-500">{L.released}</dt>
          <dd>{releaseText(locale, x.released_at, x.released_source) ?? NA}{x.released_at ? <span className="block text-xs text-slate-400">{L.releasedHint}</span> : null}</dd>
        </dl>

        <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{L.toolDisclaimer}</p>
      </article>

      <ToolCommunity toolId={x.id} locale={locale} />

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{L.otherInCat(cat)}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
                <Link href={toolHref(locale, r.id)} className="font-medium text-indigo-700 hover:underline">{r.name}</Link>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{toolDesc(locale, r)}</p>
                {ps[r.id] && <VoteSummary up={ps[r.id].up} down={ps[r.id].down} className="mt-1" locale={locale} />}
                {relHealth[r.id] && <HealthBadge health={relHealth[r.id]} locale={locale} className="mt-1" />}
              </li>
            ))}
          </ul>
          <Link href={categoryHref(locale, x.category)} className="mt-3 inline-block text-sm text-indigo-600 hover:underline">{L.allInCat(cat)}</Link>
        </section>
      )}
    </main>
  );
}
