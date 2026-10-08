import type { Metadata } from "next";
import Link from "next/link";
import SearchApp from "@/components/SearchApp";
import { jsonLd, langAlternates, siteDesc, siteName, SITE_URL, CATEGORY_INTRO } from "@/lib/site";
import { CATEGORIES } from "@/lib/types";
import { categoryHref, catName, CATEGORY_INTRO_EN, HTML_LANG, OG_LOCALE, t, type Locale } from "@/lib/i18n";

const CONTACT = "jayren1121@gmail.com";

export function homeMetadata(locale: Locale): Metadata {
  const name = siteName(locale), desc = siteDesc(locale);
  const alt = langAlternates("/", locale);
  const title = locale === "en" ? `${name} – Compare AI Tool Pricing, Plans & Reviews` : name;
  return {
    title: { absolute: title }, description: desc, alternates: alt, applicationName: siteName(locale),
    openGraph: { type: "website", siteName: name, title, description: desc, url: alt.canonical, locale: OG_LOCALE[locale], alternateLocale: [OG_LOCALE[locale === "en" ? "zh" : "en"]], images: [{ url: "/logo.png", alt: name }] },
    twitter: { card: "summary", title, description: desc, images: ["/logo.png"] },
  };
}

export default function HomeView({ locale }: { locale: Locale }) {
  const L = t(locale);
  const ld = {
    "@context": "https://schema.org", "@type": "WebSite", name: siteName(locale), url: SITE_URL + (locale === "en" ? "/en" : "/"), description: siteDesc(locale), inLanguage: HTML_LANG[locale],
  };
  const intro = locale === "en" ? CATEGORY_INTRO_EN : CATEGORY_INTRO;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <SearchApp locale={locale} />
      <section className="mx-auto max-w-5xl px-4 pb-10" aria-labelledby="cats">
        <h2 id="cats" className="mb-3 mt-6 text-lg font-semibold">{L.browseCats}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.keys(CATEGORIES).map((k) => (
            <li key={k} className="rounded-xl bg-white p-4 shadow-sm">
              <Link href={categoryHref(locale, k)} className="font-semibold text-indigo-700 hover:underline">{catName(locale, k)}</Link>
              <p className="mt-1 text-xs text-slate-500">{intro[k]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-slate-400">{siteDesc(locale)} {L.homeNote}</p>
      </section>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} {L.footerCopy}</span>
          <span>{L.contact}<a href={`mailto:${CONTACT}`} className="text-indigo-700 hover:underline">{CONTACT}</a></span>
        </div>
      </footer>
    </>
  );
}
