import Link from "next/link";
import SearchApp from "@/components/SearchApp";
import { CATEGORY_INTRO, categoryName, categoryPath, jsonLd, SITE_DESC, SITE_NAME, SITE_URL } from "@/lib/site";
import { CATEGORIES } from "@/lib/types";

export default function Page() {
  const ld = {
    "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/", description: SITE_DESC, inLanguage: "zh-Hant-TW",
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <SearchApp />
      <section className="mx-auto max-w-5xl px-4 pb-10" aria-labelledby="cats">
        <h2 id="cats" className="mb-3 mt-6 text-lg font-semibold">依分類瀏覽 AI 工具</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(CATEGORIES).map((k) => (
            <li key={k} className="rounded-xl bg-white p-4 shadow-sm">
              <Link href={categoryPath(k)} className="font-semibold text-indigo-700 hover:underline">{categoryName(k)}</Link>
              <p className="mt-1 text-xs text-slate-500">{CATEGORY_INTRO[k]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-slate-400">{SITE_DESC} 資料由公開網頁自動整理，AI 診斷僅供參考，價格請以官網為準。</p>
      </section>
    </>
  );
}
