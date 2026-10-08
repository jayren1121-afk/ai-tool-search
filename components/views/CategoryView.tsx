import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import VoteSummary from "@/components/VoteSummary";
import { CATEGORY_INTRO, jsonLd, langAlternates, siteName, SITE_SHORT, SITE_URL } from "@/lib/site";
import { getPublicStats, getToolsByCategory } from "@/lib/tools-server";
import { CATEGORIES } from "@/lib/types";
import { categoryHref, catName, CATEGORY_INTRO_EN, HTML_LANG, lp, OG_LOCALE, pricingName, t, toolDesc, toolHref, type Locale } from "@/lib/i18n";

const intro = (loc: Locale, k: string) => (loc === "en" ? CATEGORY_INTRO_EN[k] : CATEGORY_INTRO[k]) ?? "";

export function categoryMetadata(slug: string, locale: Locale): Metadata {
  const L = t(locale);
  if (!CATEGORIES[slug]) return { title: L.catNotFound, robots: { index: false } };
  const name = catName(locale, slug);
  const title = L.catTitle(name);
  const description = (locale === "en" ? `${intro(locale, slug)} Listed on ${siteName(locale)}.` : `${intro(locale, slug)} 收錄於 ${siteName(locale)}。`).slice(0, 155);
  const alt = langAlternates(`/category/${encodeURIComponent(slug)}`, locale);
  return {
    title, description, alternates: alt, applicationName: siteName(locale),
    openGraph: { type: "website", title: `${title} | ${SITE_SHORT}`, description, url: alt.canonical, siteName: siteName(locale), locale: OG_LOCALE[locale], images: [{ url: "/logo.png", alt: siteName(locale) }] },
    twitter: { card: "summary", title: `${title} | ${SITE_SHORT}`, description, images: ["/logo.png"] },
  };
}

export default async function CategoryView({ slug, locale }: { slug: string; locale: Locale }) {
  if (!CATEGORIES[slug]) notFound();
  const L = t(locale);
  const tools = await getToolsByCategory(slug, 200, locale); // 連線失敗時丟出例外，不會把空清單快取
  const stats = await getPublicStats(tools.map((x) => x.id));
  const name = catName(locale, slug);
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", inLanguage: HTML_LANG[locale], itemListElement: [
      { "@type": "ListItem", position: 1, name: L.home, item: SITE_URL + lp(locale, "/") },
      { "@type": "ListItem", position: 2, name, item: SITE_URL + categoryHref(locale, slug) } ] },
    { "@context": "https://schema.org", "@type": "ItemList", name: L.catH1(name), inLanguage: HTML_LANG[locale], numberOfItems: tools.length,
      itemListElement: tools.slice(0, 100).map((x, i) => ({ "@type": "ListItem", position: i + 1, url: SITE_URL + toolHref(locale, x.id), name: x.name })) },
  ];
  return (
    <main className="mx-auto max-w-4xl p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Breadcrumb locale={locale} items={[{ name: L.home, href: lp(locale, "/") }, { name }]} />
      <h1 className="text-2xl font-bold">{L.catH1(name)}</h1>
      <p className="mt-2 text-slate-600">{intro(locale, slug)}</p>
      <p className="mt-1 text-sm text-slate-400">{L.catCount(tools.length)}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {tools.map((x) => (
          <li key={x.id} className="rounded-xl bg-white p-4 shadow-sm">
            <Link href={toolHref(locale, x.id)} className="font-semibold text-indigo-700 hover:underline">{x.name}</Link>
            {x.pricing_model && <span className="ml-2 rounded bg-emerald-50 px-2 py-0.5 text-xs">{pricingName(locale, x.pricing_model)}</span>}
            <p className="mt-1 text-sm text-slate-600">{toolDesc(locale, x)}</p>
            {stats[x.id] && <VoteSummary up={stats[x.id].up} down={stats[x.id].down} className="mt-2" locale={locale} />}
          </li>
        ))}
      </ul>
      <nav className="mt-8">
        <h2 className="mb-2 font-semibold">{L.otherCats}</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.keys(CATEGORIES).filter((k) => k !== slug).map((k) => <Link key={k} href={categoryHref(locale, k)} className="rounded-full bg-white px-3 py-1 shadow-sm hover:text-indigo-600">{catName(locale, k)}</Link>)}
        </div>
      </nav>
    </main>
  );
}
